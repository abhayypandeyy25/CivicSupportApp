"""
Simple CSV validation script (no external dependencies)
"""
import csv

def validate_csv():
    """Validate the CSV template structure"""

    print("=" * 60)
    print("CSV Template Validation")
    print("=" * 60)

    with open('officials_template.csv', 'r') as f:
        reader = csv.DictReader(f)

        # Check headers
        expected_headers = ['name', 'email', 'phone', 'designation', 'department', 'hierarchy_level', 'area', 'categories']
        actual_headers = reader.fieldnames

        print("\n1. Header Validation:")
        print(f"   Expected: {expected_headers}")
        print(f"   Actual: {actual_headers}")
        print(f"   Result: {'✓ PASS' if actual_headers == expected_headers else '✗ FAIL'}")

        # Read and validate rows
        rows = list(reader)
        print(f"\n2. Row Count:")
        print(f"   Total officials: {len(rows)}")
        print(f"   Expected: 10")
        print(f"   Result: {'✓ PASS' if len(rows) == 10 else '✗ FAIL'}")

        # Validate each row
        print("\n3. Data Validation:")
        errors = []
        for i, row in enumerate(rows, start=2):  # Start at 2 (header is row 1)
            if not row.get('name', '').strip():
                errors.append(f"Row {i}: Missing name")
            if not row.get('designation', '').strip():
                errors.append(f"Row {i}: Missing designation")
            if not row.get('department', '').strip():
                errors.append(f"Row {i}: Missing department")

        if errors:
            print(f"   Found {len(errors)} validation errors:")
            for error in errors:
                print(f"   - {error}")
            print(f"   Result: ✗ FAIL")
        else:
            print(f"   All rows have required fields")
            print(f"   Result: ✓ PASS")

        # Show sample official
        print("\n4. Sample Official (Row 1):")
        if rows:
            official = rows[0]
            print(f"   Name: {official.get('name')}")
            print(f"   Designation: {official.get('designation')}")
            print(f"   Department: {official.get('department')}")
            print(f"   Hierarchy: {official.get('hierarchy_level')}")
            print(f"   Area: {official.get('area')}")
            print(f"   Categories: {official.get('categories')}")

        # Hierarchy level validation
        print("\n5. Hierarchy Level Validation:")
        valid_numbers = ['1', '2', '3', '4', '5', '6', '7']
        valid_names = ['parshad', 'mcd', 'ias', 'mla', 'mp', 'cm', 'pm']
        hierarchy_errors = []

        for i, row in enumerate(rows, start=2):
            level = str(row.get('hierarchy_level', '1')).strip().lower()
            if level not in valid_numbers and level not in valid_names:
                hierarchy_errors.append(f"Row {i}: Invalid hierarchy level '{level}'")

        if hierarchy_errors:
            print(f"   Found {len(hierarchy_errors)} hierarchy errors:")
            for error in hierarchy_errors:
                print(f"   - {error}")
            print(f"   Result: ✗ FAIL")
        else:
            print(f"   All hierarchy levels are valid")
            print(f"   Result: ✓ PASS")

    print("\n" + "=" * 60)
    print("Validation Complete")
    print("=" * 60)

if __name__ == "__main__":
    validate_csv()
