import sqlite3
import random
from datetime import datetime, timedelta
import os

os.makedirs("data", exist_ok=True)
db_path = "data/target.db"

def seed_db():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("DROP TABLE IF EXISTS order_items;")
    cursor.execute("DROP TABLE IF EXISTS orders;")
    cursor.execute("DROP TABLE IF EXISTS products;")
    cursor.execute("DROP TABLE IF EXISTS customers;")
    cursor.execute("DROP TABLE IF EXISTS users;") # Cleanup old dummy table

    cursor.execute("""
    CREATE TABLE customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        country TEXT NOT NULL,
        signup_date DATE NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        cost DECIMAL(10, 2) NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        order_date DATE NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE order_items (
        order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );
    """)

    countries = ["USA", "UK", "Canada", "Australia", "Germany"]
    categories = ["Electronics", "Clothing", "Home & Garden", "Sports"]
    
    products = [
        ("Laptop", "Electronics", 999.99, 750.00),
        ("Smartphone", "Electronics", 699.99, 500.00),
        ("Headphones", "Electronics", 149.99, 80.00),
        ("T-Shirt", "Clothing", 19.99, 8.00),
        ("Jeans", "Clothing", 49.99, 20.00),
        ("Sneakers", "Clothing", 79.99, 35.00),
        ("Coffee Maker", "Home & Garden", 89.99, 40.00),
        ("Blender", "Home & Garden", 59.99, 30.00),
        ("Yoga Mat", "Sports", 29.99, 10.00),
        ("Dumbbells", "Sports", 49.99, 25.00)
    ]
    
    cursor.executemany("INSERT INTO products (name, category, price, cost) VALUES (?, ?, ?, ?)", products)

    for i in range(1, 51):
        signup_date = datetime.now() - timedelta(days=random.randint(100, 1000))
        cursor.execute(
            "INSERT INTO customers (first_name, last_name, email, country, signup_date) VALUES (?, ?, ?, ?, ?)",
            (f"First{i}", f"Last{i}", f"user{i}@example.com", random.choice(countries), signup_date.strftime("%Y-%m-%d"))
        )

    for i in range(1, 201):
        customer_id = random.randint(1, 50)
        order_date = datetime.now() - timedelta(days=random.randint(1, 100))
        status = random.choices(["Completed", "Shipped", "Pending", "Cancelled"], weights=[70, 15, 10, 5])[0]
        cursor.execute(
            "INSERT INTO orders (customer_id, order_date, status) VALUES (?, ?, ?)",
            (customer_id, order_date.strftime("%Y-%m-%d"), status)
        )
        
        for _ in range(random.randint(1, 4)):
            product_id = random.randint(1, len(products))
            quantity = random.randint(1, 3)
            price = products[product_id-1][2]
            cursor.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
                (i, product_id, quantity, price)
            )

    conn.commit()
    conn.close()
    print("Successfully seeded e-commerce database!")

if __name__ == "__main__":
    seed_db()
