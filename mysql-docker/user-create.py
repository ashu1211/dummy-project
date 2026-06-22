from faker import Faker
import random
from datetime import datetime

fake = Faker("en_IN")

roles = [
    "Frontend Engineer",
    "Backend Engineer",
    "Database Admin",
    "Platform Engineer",
    "DevOps Engineer",
    "QA Engineer",
    "Software Developer",
    "Cloud Engineer",
    "Security Engineer",
    "Data Engineer"
]

with open("users.sql", "w") as f:
    f.write("INSERT INTO users (name, email, role, created_at) VALUES\n")

    records = []

    for _ in range(10):
        name = fake.name()
        email = fake.unique.email()
        role = random.choice(roles)
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        records.append(
            f"('{name}', '{email}', '{role}', '{created_at}')"
        )

    f.write(",\n".join(records))
    f.write(";")

print("Generated users.sql with 100000 records")
