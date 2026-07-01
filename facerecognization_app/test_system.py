import base64
import requests
import json
import os

API_URL = "http://localhost:8000"
IMAGE_PATH = "/home/kumar.ashwani/.gemini/antigravity/brain/d2b4839f-aad1-4de0-9389-bb2649dac7c0/test_face_1_1782724639245.png"

def run_tests():
    print("--- STARTING SYSTEM INTEGRATION TESTS ---")
    
    if not os.path.exists(IMAGE_PATH):
        print(f"Error: Test image not found at {IMAGE_PATH}")
        return

    # 1. Base64 encode image
    with open(IMAGE_PATH, "rb") as image_file:
        img_b64 = base64.b64encode(image_file.read()).decode('utf-8')
        img_data_url = f"data:image/png;base64,{img_b64}"

    # 2. Test Scan Unrecognized Face
    print("\n[Step 1] Scanning new face (should be unrecognized)...")
    scan_resp = requests.post(f"{API_URL}/api/detect-recognize", json={"image": img_data_url})
    if scan_resp.status_code != 200:
        print(f"Failed to scan: {scan_resp.text}")
        return
    
    scan_data = scan_resp.json()
    print("Scan Response:", json.dumps(scan_data, indent=2))
    assert scan_data["detected"] == True, "Face should be detected!"
    assert scan_data["recognized"] == False, "Face should be unrecognized!"
    print("✓ Face successfully detected as unrecognized.")

    # 3. Test Register & Check-In
    print("\n[Step 2] Registering and checking in visitor...")
    checkin_payload = {
        "visitor_id": None,
        "name": "John Doe",
        "to_meet": "Rajesh Kumar (CTO)",
        "from_location": "Google India (Bengaluru)",
        "purpose": "Technical Partnership Discussion",
        "image": img_data_url,
        "register_new": True
    }
    
    checkin_resp = requests.post(f"{API_URL}/api/checkin", json=checkin_payload)
    if checkin_resp.status_code != 200:
        print(f"Failed check-in: {checkin_resp.text}")
        return
        
    checkin_data = checkin_resp.json()
    print("Check-in Response:", json.dumps(checkin_data, indent=2))
    assert checkin_data["success"] == True, "Check-in should be successful!"
    visitor_id = checkin_data["visitor_id"]
    print(f"✓ Visitor successfully registered with ID {visitor_id}.")

    # 4. Test Scan Recognized Face
    print("\n[Step 3] Scanning face again (should now be recognized!)...")
    scan_resp2 = requests.post(f"{API_URL}/api/detect-recognize", json={"image": img_data_url})
    scan_data2 = scan_resp2.json()
    print("Scan 2 Response:", json.dumps(scan_data2, indent=2))
    assert scan_data2["detected"] == True, "Face should be detected!"
    assert scan_data2["recognized"] == True, "Face should be recognized!"
    assert scan_data2["name"] == "John Doe", "Name should be John Doe!"
    print("✓ Face successfully recognized as John Doe.")

    # 5. Test Check-In Recognized Visitor
    print("\n[Step 4] Checking in recognized visitor again...")
    checkin_payload2 = {
        "visitor_id": visitor_id,
        "name": "John Doe",
        "to_meet": "Rajesh Kumar (CTO)",
        "from_location": "Google India (Bengaluru)",
        "purpose": "Follow up meeting",
        "image": img_data_url,
        "register_new": False
    }
    checkin_resp2 = requests.post(f"{API_URL}/api/checkin", json=checkin_payload2)
    checkin_data2 = checkin_resp2.json()
    print("Check-in 2 Response:", json.dumps(checkin_data2, indent=2))
    assert checkin_data2["success"] == True, "Check-in should be successful!"
    assert checkin_data2["visit_count"] == 2, "Visit count should have incremented to 2!"
    print(f"✓ Visit count successfully incremented to {checkin_data2['visit_count']}.")

    # 6. Verify stats and logs
    print("\n[Step 5] Fetching stats and logs...")
    stats_resp = requests.get(f"{API_URL}/api/stats")
    print("Dashboard Stats:", json.dumps(stats_resp.json(), indent=2))
    
    logs_resp = requests.get(f"{API_URL}/api/logs")
    logs = logs_resp.json()
    print(f"Total Logs count: {len(logs)}")
    print("Latest log detail:", json.dumps(logs[0], indent=2))
    
    visitors_resp = requests.get(f"{API_URL}/api/visitors")
    print("Registered Visitors:", json.dumps(visitors_resp.json(), indent=2))
    
    print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
