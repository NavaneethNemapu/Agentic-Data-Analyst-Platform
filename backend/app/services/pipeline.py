from app.agents.sql_generator import SQLGeneratorAgent
from app.agents.schema_linker import SchemaLinkerAgent
from app.agents.query_planner import QueryPlannerAgent
from app.agents.validator import ValidatorAgent
from app.db.target import execute_query, get_schema
from app.db.system_db import SessionLocal, ChatSession, ChatMessage, UserQuery
from app.services.experience_bank import experience_bank
import uuid

class WorkflowStateMachine:
    def __init__(
        self,
        schema_linker_provider: str | None = None,
        schema_linker_model: str | None = None,
        query_planner_provider: str | None = None,
        query_planner_model: str | None = None,
        sql_generator_provider: str | None = None,
        sql_generator_model: str | None = None,
        validator_provider: str | None = None,
        validator_model: str | None = None
    ):
        self.schema_linker = SchemaLinkerAgent(provider=schema_linker_provider, model=schema_linker_model)
        self.query_planner = QueryPlannerAgent(provider=query_planner_provider, model=query_planner_model)
        self.sql_generator = SQLGeneratorAgent(provider=sql_generator_provider, model=sql_generator_model)
        self.validator = ValidatorAgent(provider=validator_provider, model=validator_model)
        self.max_retries = 3
        
    async def run(
        self,
        question: str,
        session_id: str | None = None,
        progress_callback=None,
        models: dict[str, str] | None = None,
        providers: dict[str, str] | None = None,
        user_id: str | None = None
    ) -> dict:
        if providers:
            if "schema_linker" in providers:
                self.schema_linker.set_routing(provider=providers["schema_linker"])
            if "query_planner" in providers:
                self.query_planner.set_routing(provider=providers["query_planner"])
            if "sql_generator" in providers:
                self.sql_generator.set_routing(provider=providers["sql_generator"])
            if "validator" in providers:
                self.validator.set_routing(provider=providers["validator"])

        if models:
            for role, agent in [
                ("schema_linker", self.schema_linker),
                ("query_planner", self.query_planner),
                ("sql_generator", self.sql_generator),
                ("validator", self.validator)
            ]:
                if role in models:
                    val = models[role]
                    if val and ":" in val:
                        p, m = val.split(":", 1)
                        agent.set_routing(provider=p, model=m)
                    else:
                        agent.set_routing(model=val)

        def model_tag(agent):
            p = getattr(agent, "provider", None) or "auto"
            m = getattr(agent, "model", None) or "default"
            return f" [{p} / {m}]"

        async def report(msg, status="info"):
            if progress_callback:
                await progress_callback({"message": msg, "status": status})
                
        db = SessionLocal()
        
        if not session_id:
            session_id = str(uuid.uuid4())
            new_session = ChatSession(
                id=session_id,
                user_id=user_id,
                title=question[:45] + ("..." if len(question) > 45 else "")
            )
            db.add(new_session)
            db.commit()
        else:
            existing_sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if existing_sess and user_id and not existing_sess.user_id:
                existing_sess.user_id = user_id
                db.commit()
            
        past_messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at).all()
        # Keep the most recent 6 messages to stay well within token limits while retaining rich follow-up context
        recent_messages = past_messages[-6:] if len(past_messages) > 6 else past_messages
        history_str = "\n".join([f"{m.role}: {m.content[:500]}" for m in recent_messages])
        
        user_msg = ChatMessage(session_id=session_id, role="user", content=question)
        db.add(user_msg)
        db.commit()
        
        await report("Fetching schema...", "info")
        full_schema = get_schema()
        
        await report(f"Linking relevant schema tables...{model_tag(self.schema_linker)}", "info")
        pruned_schema = await self.schema_linker.link_schema(question, full_schema, history=history_str)
        
        await report(f"Planning query steps...{model_tag(self.query_planner)}", "info")
        steps = await self.query_planner.plan(question, pruned_schema, history=history_str)
        
        executed_steps = []
        overall_status = "success"
        final_error = None
        intermediate_results = []
        final_explanation = None
        final_chart = None
        retrieved_exemplars = []
        
        for i, step in enumerate(steps):
            context = ""
            if intermediate_results:
                context = f"Context from previous steps: {intermediate_results}\n"
                
            step_query = f"{context}Current Step: {step}"
            await report(f"Generating SQL for step {i+1}/{len(steps)}: {step}{model_tag(self.sql_generator)}", "info")
            sql, exemplars = await self.sql_generator.generate_sql(step_query, pruned_schema, history=history_str)
            if exemplars:
                retrieved_exemplars.extend(exemplars)
                await report(f"Recalled {len(exemplars)} verified patterns from Analyst Experience Memory", "info")
            
            result = None
            error_msg = None
            retries = 0
            is_final_step = (i == len(steps) - 1)
            
            for attempt in range(self.max_retries):
                try:
                    await report("Executing query against database...", "info")
                    result = execute_query(sql)
                    
                    if is_final_step:
                        await report(f"Validating final result...{model_tag(self.validator)}", "info")
                        val_data = await self.validator.validate(question, sql, result, history=history_str)
                        if not val_data.get("is_valid", True):
                            raise ValueError(f"Validation failed: {val_data.get('feedback', 'Unknown error')}")
                        final_explanation = val_data.get("explanation", "")
                        final_chart = val_data.get("chart_type", "table")
                        # Original Contribution: Record newly validated analytical pattern into Experience Bank
                        experience_bank.record_experience(question, sql)
                        
                    error_msg = None
                    break
                except Exception as e:
                    error_msg = str(e)
                    if attempt < self.max_retries - 1:
                        retries += 1
                        await report(f"Database error. Correcting SQL (Attempt {attempt+1})...", "warning")
                        sql = await self.sql_generator.correct_sql(sql, error_msg, step_query, pruned_schema, history=history_str)
            
            step_data = {
                "step": step,
                "sql": sql,
                "result": result,
                "error": error_msg,
                "retries": retries
            }
            executed_steps.append(step_data)
            
            if error_msg:
                overall_status = "error"
                final_error = error_msg
                break
                
            intermediate_results.append(result)
            
        final_exp = final_explanation if final_explanation else ("Error: " + final_error if final_error else "Here are your results.")
        await report("Workflow complete.", "success" if overall_status == "success" else "error")
        asst_msg = ChatMessage(session_id=session_id, role="assistant", content=final_exp)
        db.add(asst_msg)

        calculated_confidence = round(0.96 if retrieved_exemplars else (0.91 if sum(s["retries"] for s in executed_steps) == 0 else 0.82), 2)
        final_sql = executed_steps[-1]["sql"] if executed_steps else ""
        if user_id:
            try:
                user_query_record = UserQuery(
                    user_id=user_id,
                    session_id=session_id,
                    question=question,
                    sql=final_sql,
                    chart_type=final_chart or "bar",
                    confidence=calculated_confidence,
                    status=overall_status,
                    retries=sum(s["retries"] for s in executed_steps)
                )
                db.add(user_query_record)
            except Exception as e:
                print(f"Error logging UserQuery: {e}")

        db.commit()
        db.close()
            
        return {
            "session_id": session_id,
            "question": question,
            "pruned_schema": pruned_schema,
            "plan": steps,
            "steps": executed_steps,
            "status": overall_status,
            "error": final_error,
            "sql": executed_steps[-1]["sql"] if executed_steps else "",
            "result": executed_steps[-1]["result"] if executed_steps and overall_status == "success" else None,
            "retries": sum(s["retries"] for s in executed_steps),
            "explanation": final_explanation,
            "chart_type": final_chart,
            "confidence": round(0.96 if retrieved_exemplars else (0.91 if sum(s["retries"] for s in executed_steps) == 0 else 0.82), 2),
            "memory_exemplars": retrieved_exemplars,
            "models_used": {
                "schema_linker": getattr(self.schema_linker, "model", None),
                "query_planner": getattr(self.query_planner, "model", None),
                "sql_generator": getattr(self.sql_generator, "model", None),
                "validator": getattr(self.validator, "model", None)
            },
            "providers_used": {
                "schema_linker": getattr(self.schema_linker, "provider", None),
                "query_planner": getattr(self.query_planner, "provider", None),
                "sql_generator": getattr(self.sql_generator, "provider", None),
                "validator": getattr(self.validator, "provider", None)
            }
        }



