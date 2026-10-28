import sqlite3

conn = sqlite3.connect('data/target.db')
queries = [
    ('Q11', 'SELECT c.first_name, c.last_name, o.order_date FROM customers c JOIN orders o ON c.customer_id = o.customer_id ORDER BY o.order_date DESC LIMIT 1'),
    ('Q12', 'SELECT category, count(product_id) AS product_count FROM products GROUP BY category ORDER BY product_count DESC'),
    ('Q13', "SELECT round(sum(oi.quantity * oi.unit_price), 2) AS shipped_revenue FROM orders o JOIN order_items oi ON o.order_id = oi.order_id WHERE o.status = 'Shipped'"),
    ('Q14', 'SELECT name, round(price - cost, 2) AS margin FROM products ORDER BY margin DESC LIMIT 1'),
    ('Q15', "SELECT count(o.order_id) FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE c.country = 'Germany'"),
    ('Q16', 'SELECT p.name, sum(oi.quantity) AS total_sold FROM products p JOIN order_items oi ON p.product_id = oi.product_id GROUP BY p.product_id ORDER BY total_sold DESC LIMIT 1'),
    ('Q17', 'SELECT c.country, sum(oi.quantity) AS total_qty FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_items oi ON o.order_id = oi.order_id GROUP BY c.country ORDER BY total_qty DESC'),
    ('Q18', 'SELECT c.first_name, c.last_name, c.email FROM customers c LEFT JOIN orders o ON c.customer_id = o.customer_id WHERE o.order_id IS NULL'),
    ('Q19', 'SELECT round(sum(price), 2) FROM products WHERE price > 100'),
    ('Q20', 'SELECT p.category, round(sum(oi.quantity * (p.price - p.cost)), 2) AS total_profit FROM products p JOIN order_items oi ON p.product_id = oi.product_id GROUP BY p.category ORDER BY total_profit DESC LIMIT 1')
]
for qid, sql in queries:
    res = conn.execute(sql).fetchall()
    print(f'{qid}: count={len(res)}, sample={res[:1]}')
