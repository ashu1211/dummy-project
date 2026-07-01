import sqlite3
import os
import json
import datetime
import numpy as np

DB_DIR = "data"
DB_PATH = os.path.join(DB_DIR, "visitors.db")
PHOTOS_DIR = os.path.join(DB_DIR, "photos")
SNAPSHOTS_DIR = os.path.join(DB_DIR, "snapshots")

def init_db():
    """Initializes the database directory and tables if they don't exist."""
    # Ensure directories exist
    os.makedirs(DB_DIR, exist_ok=True)
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    os.makedirs(SNAPSHOTS_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create registered_visitors table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS registered_visitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            embedding TEXT NOT NULL,
            photo_path TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    
    # Create visit_logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visitor_id INTEGER,
            name TEXT NOT NULL,
            to_meet TEXT NOT NULL,
            from_location TEXT NOT NULL,
            purpose TEXT,
            visit_time TEXT NOT NULL,
            photo_path TEXT NOT NULL,
            FOREIGN KEY (visitor_id) REFERENCES registered_visitors(id)
        )
    """)

    # Create visitor_identities table for Government & Private IDs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visitor_identities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visitor_id INTEGER UNIQUE NOT NULL,
            -- Government IDs
            aadhar_no      TEXT,
            pan_no         TEXT,
            voter_id       TEXT,
            driving_license TEXT,
            passport_no    TEXT,
            -- Private / Organizational Info
            company_name   TEXT,
            company_id     TEXT,
            school_name    TEXT,
            college_name   TEXT,
            office_address TEXT,
            updated_at     TEXT,
            FOREIGN KEY (visitor_id) REFERENCES registered_visitors(id)
        )
    """)
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Gets a connection to the SQLite database with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def register_visitor(name, embedding_arr, photo_path):
    """Registers a new visitor in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    embedding_json = json.dumps(embedding_arr.tolist())
    created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute(
        "INSERT INTO registered_visitors (name, embedding, photo_path, created_at) VALUES (?, ?, ?, ?)",
        (name, embedding_json, photo_path, created_at)
    )
    visitor_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    return visitor_id

def add_visit_log(visitor_id, name, to_meet, from_location, purpose, photo_path):
    """Adds a new check-in record to the visit logs."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    visit_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute(
        """
        INSERT INTO visit_logs (visitor_id, name, to_meet, from_location, purpose, visit_time, photo_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (visitor_id, name, to_meet, from_location, purpose, visit_time, photo_path)
    )
    log_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    return log_id

def get_all_visitors():
    """Gets all registered visitors along with their total visit count and registration details."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT rv.id, rv.name, rv.photo_path, rv.created_at, COUNT(vl.id) as visit_count
        FROM registered_visitors rv
        LEFT JOIN visit_logs vl ON rv.id = vl.visitor_id
        GROUP BY rv.id
        ORDER BY rv.name ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    visitors = []
    for row in rows:
        visitors.append({
            "id": row["id"],
            "name": row["name"],
            "photo_path": row["photo_path"],
            "created_at": row["created_at"],
            "visit_count": row["visit_count"]
        })
    return visitors

def get_visitor_embeddings():
    """Loads all registered visitor embeddings for memory cache."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, embedding FROM registered_visitors")
    rows = cursor.fetchall()
    conn.close()
    
    embeddings = []
    for row in rows:
        embedding_list = json.loads(row["embedding"])
        embeddings.append({
            "id": row["id"],
            "name": row["name"],
            "embedding": np.array(embedding_list, dtype=np.float32)
        })
    return embeddings

def get_all_visit_logs(limit=100):
    """Retrieves list of check-in logs with detailed host and frequency metrics."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(f"""
        SELECT vl.id, vl.visitor_id, vl.name, vl.to_meet, vl.from_location, vl.purpose, vl.visit_time, vl.photo_path,
               (SELECT COUNT(*) FROM visit_logs vl2 WHERE vl2.visitor_id = vl.visitor_id OR (vl.visitor_id IS NULL AND vl2.name = vl.name)) as visit_number
        FROM visit_logs vl
        ORDER BY vl.visit_time DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    logs = []
    for row in rows:
        logs.append({
            "id": row["id"],
            "visitor_id": row["visitor_id"],
            "name": row["name"],
            "to_meet": row["to_meet"],
            "from_location": row["from_location"],
            "purpose": row["purpose"],
            "visit_time": row["visit_time"],
            "photo_path": row["photo_path"],
            "visit_number": row["visit_number"]
        })
    return logs

def get_visitor_stats(visitor_id):
    """Returns total visits and last visit details for a specific registered visitor."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get total count
    cursor.execute("SELECT COUNT(*) FROM visit_logs WHERE visitor_id = ?", (visitor_id,))
    total_visits = cursor.fetchone()[0]
    
    # Get last visit details
    cursor.execute("""
        SELECT to_meet, from_location, visit_time 
        FROM visit_logs 
        WHERE visitor_id = ? 
        ORDER BY visit_time DESC 
        LIMIT 1 OFFSET 1
    """, (visitor_id,))
    last_row = cursor.fetchone()
    
    conn.close()
    
    if last_row:
        return {
            "total_visits": total_visits,
            "last_visit_time": last_row["visit_time"],
            "last_meet": last_row["to_meet"],
            "last_from": last_row["from_location"]
        }
    else:
        return {
            "total_visits": total_visits,
            "last_visit_time": None,
            "last_meet": None,
            "last_from": None
        }

def get_visitor_recent_logs(visitor_id, limit=5):
    """Returns the last N visit log entries for a specific registered visitor."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT to_meet, from_location, purpose, visit_time, photo_path
        FROM visit_logs
        WHERE visitor_id = ?
        ORDER BY visit_time DESC
        LIMIT ?
    """, (visitor_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "to_meet": row["to_meet"],
            "from_location": row["from_location"],
            "purpose": row["purpose"] or "N/A",
            "visit_time": row["visit_time"],
            "photo_path": row["photo_path"]
        }
        for row in rows
    ]

def get_dashboard_data():
    """Generates counts, hourly distributions, and lists for dashboard visualization."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    # 1. Total Registered
    cursor.execute("SELECT COUNT(*) FROM registered_visitors")
    total_registered = cursor.fetchone()[0]
    
    # 2. Today's Total Visits
    cursor.execute("SELECT COUNT(*) FROM visit_logs WHERE visit_time LIKE ?", (f"{today_str}%",))
    today_visits = cursor.fetchone()[0]
    
    # 3. Hourly visits for today
    # We will initialize 24 hours with 0
    hourly_stats = {f"{i:02d}:00": 0 for i in range(24)}
    cursor.execute("""
        SELECT substr(visit_time, 12, 2) as hour, COUNT(*) as count 
        FROM visit_logs 
        WHERE visit_time LIKE ?
        GROUP BY hour
    """, (f"{today_str}%",))
    for row in cursor.fetchall():
        hour_key = f"{row['hour']}:00"
        hourly_stats[hour_key] = row["count"]
        
    # 4. Top Hosts to meet
    cursor.execute("""
        SELECT to_meet, COUNT(*) as count 
        FROM visit_logs 
        GROUP BY to_meet 
        ORDER BY count DESC 
        LIMIT 5
    """)
    top_hosts = [{"host": row["to_meet"], "count": row["count"]} for row in cursor.fetchall()]
    
    # 5. Top origins (from_location)
    cursor.execute("""
        SELECT from_location, COUNT(*) as count
        FROM visit_logs
        GROUP BY from_location
        ORDER BY count DESC
        LIMIT 5
    """)
    top_origins = [{"location": row["from_location"], "count": row["count"]} for row in cursor.fetchall()]

    conn.close()
    
    return {
        "total_registered": total_registered,
        "today_visits": today_visits,
        "hourly_stats": hourly_stats,
        "top_hosts": top_hosts,
        "top_origins": top_origins
    }

_IDENTITY_FIELDS = [
    "aadhar_no", "pan_no", "voter_id", "driving_license", "passport_no",
    "company_name", "company_id", "school_name", "college_name", "office_address"
]

def save_visitor_identity(visitor_id: int, data: dict):
    """Upserts government and private ID details for a registered visitor."""
    conn = get_db_connection()
    cursor = conn.cursor()
    updated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Build safe column/value pairs from known fields only
    cols = [f for f in _IDENTITY_FIELDS if f in data]
    values = [data[f] for f in cols]

    # Try insert first; if visitor already has a row, update it
    cursor.execute("SELECT id FROM visitor_identities WHERE visitor_id = ?", (visitor_id,))
    existing = cursor.fetchone()

    if existing:
        if cols:
            set_clause = ", ".join(f"{c} = ?" for c in cols)
            cursor.execute(
                f"UPDATE visitor_identities SET {set_clause}, updated_at = ? WHERE visitor_id = ?",
                values + [updated_at, visitor_id]
            )
    else:
        all_cols = ["visitor_id"] + cols + ["updated_at"]
        placeholders = ", ".join("?" for _ in all_cols)
        cursor.execute(
            f"INSERT INTO visitor_identities ({', '.join(all_cols)}) VALUES ({placeholders})",
            [visitor_id] + values + [updated_at]
        )

    conn.commit()
    conn.close()

def get_visitor_identity(visitor_id: int):
    """Returns stored government and private ID details for a visitor, or empty dict if none."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM visitor_identities WHERE visitor_id = ?", (visitor_id,)
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {f: "" for f in _IDENTITY_FIELDS}
    return {f: (row[f] or "") for f in _IDENTITY_FIELDS}
