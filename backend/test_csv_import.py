"""
Test script for CSV bulk import functionality
Run this after starting the server: uvicorn server:app --reload
"""
import requests
import json

API_BASE_URL = "http://localhost:8000"

def test_csv_import():
    """Test the CSV import endpoint"""

    # Read the CSV template
    with open('officials_template.csv', 'r') as f:
        csv_content = f.read()

    print("=" * 60)
    print("Testing CSV Bulk Import Endpoint")
    print("=" * 60)

    # Test 1: Import without authentication (should fail)
    print("\n1. Testing without authentication...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/admin/officials/bulk-import-csv",
            json={"csv_content": csv_content}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Expected: 401 (Unauthorized)")
        print(f"   Result: {'✓ PASS' if response.status_code == 401 else '✗ FAIL'}")
    except Exception as e:
        print(f"   Error: {e}")

    # Test 2: Check CSV parsing logic separately
    print("\n2. Testing CSV parsing logic...")
    print(f"   CSV has {len(csv_content.split(chr(10)))} lines")
    print(f"   Expected: 11 lines (1 header + 10 officials)")
    print(f"   Result: {'✓ PASS' if len(csv_content.split(chr(10))) == 11 else '✗ FAIL'}")

    # Test 3: Verify CSV format
    print("\n3. Verifying CSV format...")
    lines = csv_content.strip().split('\n')
    header = lines[0]
    expected_columns = ['name', 'email', 'phone', 'designation', 'department', 'hierarchy_level', 'area', 'categories']
    actual_columns = header.split(',')
    print(f"   Expected columns: {expected_columns}")
    print(f"   Actual columns: {actual_columns}")
    print(f"   Result: {'✓ PASS' if actual_columns == expected_columns else '✗ FAIL'}")

    # Test 4: Verify sample data
    print("\n4. Verifying sample data...")
    first_official = lines[1].split(',')
    print(f"   First official name: {first_official[0]}")
    print(f"   Expected: Rajesh Kumar")
    print(f"   Result: {'✓ PASS' if first_official[0] == 'Rajesh Kumar' else '✗ FAIL'}")

    print("\n" + "=" * 60)
    print("CSV Import Validation Complete")
    print("=" * 60)
    print("\nNote: To test with authentication, you need to:")
    print("1. Start the backend server: uvicorn server:app --reload")
    print("2. Create an admin user in MongoDB")
    print("3. Get a Firebase auth token")
    print("4. Include token in Authorization header")
    print("\nManual test command:")
    print('curl -X POST http://localhost:8000/api/admin/officials/bulk-import-csv \\')
    print('  -H "Authorization: Bearer YOUR_TOKEN" \\')
    print('  -H "Content-Type: application/json" \\')
    print('  -d \'{"csv_content": "..."}\'')

if __name__ == "__main__":
    test_csv_import()
