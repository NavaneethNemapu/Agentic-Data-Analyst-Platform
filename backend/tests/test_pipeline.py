import pytest
from unittest.mock import patch, AsyncMock
from app.services.pipeline import WorkflowStateMachine

@pytest.mark.asyncio
async def test_workflow_state_machine_single_step():
    pipeline = WorkflowStateMachine()
    
    with patch("app.services.pipeline.get_schema", return_value="CREATE TABLE users (id INTEGER);"):
        with patch.object(pipeline.schema_linker.llm, "generate", new_callable=AsyncMock) as mock_link:
            mock_link.return_value = "CREATE TABLE users (id INTEGER);"
            with patch.object(pipeline.query_planner.llm, "generate", new_callable=AsyncMock) as mock_plan:
                mock_plan.return_value = '["Get users"]'
                with patch.object(pipeline.sql_generator.llm, "generate", new_callable=AsyncMock) as mock_generate:
                    mock_generate.return_value = "SELECT * FROM users;"
                    with patch("app.services.pipeline.execute_query", return_value=[{"id": 1}]) as mock_execute:
                        with patch.object(pipeline.validator.llm, "generate", new_callable=AsyncMock) as mock_valid:
                            mock_valid.return_value = '{"is_valid": true, "feedback": "", "explanation": "Done.", "chart_type": "table"}'
                            
                            result = await pipeline.run("Get users")
                            
                            assert result["status"] == "success"
                            assert result["plan"] == ["Get users"]
                            assert len(result["steps"]) == 1
                            assert result["result"] == [{"id": 1}]
                            assert result["explanation"] == "Done."
                            assert result["chart_type"] == "table"

@pytest.mark.asyncio
async def test_workflow_state_machine_multi_step():
    pipeline = WorkflowStateMachine()
    
    with patch("app.services.pipeline.get_schema", return_value="CREATE TABLE users (id INTEGER);"):
        with patch.object(pipeline.schema_linker.llm, "generate", new_callable=AsyncMock) as mock_link:
            mock_link.return_value = "CREATE TABLE users (id INTEGER);"
            with patch.object(pipeline.query_planner.llm, "generate", new_callable=AsyncMock) as mock_plan:
                mock_plan.return_value = '["Step 1", "Step 2"]'
                with patch.object(pipeline.sql_generator.llm, "generate", new_callable=AsyncMock) as mock_generate:
                    mock_generate.side_effect = ["SELECT 1;", "SELECT 2;"]
                    with patch("app.services.pipeline.execute_query", side_effect=[[{"step": 1}], [{"step": 2}]]) as mock_execute:
                        with patch.object(pipeline.validator.llm, "generate", new_callable=AsyncMock) as mock_valid:
                            mock_valid.return_value = '{"is_valid": true, "feedback": "", "explanation": "Multi Done.", "chart_type": "bar"}'
                            
                            result = await pipeline.run("Do two things")
                            
                            assert result["status"] == "success"
                            assert result["plan"] == ["Step 1", "Step 2"]
                            assert len(result["steps"]) == 2
                            assert result["result"] == [{"step": 2}]
                            assert result["explanation"] == "Multi Done."
                            assert result["chart_type"] == "bar"

