# CSV Bulk Import for Government Officials

This feature allows administrators to quickly import multiple government officials using CSV files, making it easy to populate the database with hundreds of officials at once.

## Features

- Upload CSV files from your device
- Bulk import hundreds of officials in seconds
- Automatic validation with detailed error reporting
- Support for flexible hierarchy level input (names or numbers)
- Category parsing for multiple issue types
- Download CSV template guide
- **NEW!** 🎉 **Automatic hierarchy level detection and creation**
- **NEW!** 🎉 **Automatic category detection and creation**
- **NEW!** 🎉 **Infinitely flexible data structure - add ANY hierarchy level or category**

## How to Use

### 1. Prepare Your CSV File

Create a CSV file with the following columns:

```csv
name,email,phone,designation,department,hierarchy_level,area,categories
```

### 2. CSV Format Guide

#### Required Columns
- `name`: Full name of the official (required)
- `designation`: Official's designation (e.g., "Ward Councillor", "MLA") (required)
- `department`: Department name (e.g., "Municipal Corporation of Delhi") (required)

#### Optional Columns
- `email`: Contact email address
- `phone`: Contact phone number (with country code, e.g., +919876543210)
- `hierarchy_level`: Level in government hierarchy (see below)
- `area`: Ward/Constituency name
- `categories`: Comma-separated list of issue categories they handle

#### Hierarchy Levels

**🎉 NEW: Automatic Detection!**

You can now use **ANY hierarchy level name** - the system will automatically detect and create new levels!

**Pre-defined levels** (numbers 1-7):

| Number | Name | Description |
|--------|------|-------------|
| 1 | Parshad | Ward Councillor - Local ward issues |
| 2 | MCD | Municipal Corporation - City level civic issues |
| 3 | IAS | IAS Officers - Administrative issues |
| 4 | MLA | Member of Legislative Assembly - Constituency level |
| 5 | MP | Member of Parliament - Parliamentary constituency |
| 6 | CM | Chief Minister - State level issues |
| 7 | PM | Prime Minister - National level issues |

**Custom levels** (automatically assigned numbers 8+):

Just use any name in your CSV! For example:
- `District Collector` → Auto-assigned as Level 8
- `Block Officer` → Auto-assigned as Level 9
- `Gram Panchayat` → Auto-assigned as Level 10
- `Tehsildar` → Auto-assigned as Level 11

The system automatically detects new hierarchy names and assigns them sequential numbers starting from 8.

#### Available Categories

**🎉 NEW: Automatic Creation!**

You can now use **ANY category name** - the system will automatically create categories that don't exist!

**Pre-defined categories**:
- `Garbage & Waste Management`
- `Road Maintenance`
- `Street Lights & Electricity`
- `Water Supply Issues`
- `Drainage & Sewage`
- `Sanitation & Public Health`
- `Parks & Green Spaces`
- `Traffic & Parking`
- `Public Safety & Crime`
- `Illegal Construction`
- `Stray Animals`
- `Government Services & Documentation`

**Custom categories** (automatically created):

Just use any category name in your CSV! For example:
- `"Cybercrime,Digital Fraud"` → Auto-creates both categories
- `"Air Quality,Noise Pollution"` → Auto-creates both categories
- `"Agriculture,Rural Development"` → Auto-creates both categories

The system automatically detects new category names and adds them to the database.

### 3. Example CSV

```csv
name,email,phone,designation,department,hierarchy_level,area,categories
Rajesh Kumar,rajesh.kumar@mcd.gov.in,+919876543210,Ward Councillor,Municipal Corporation of Delhi,Parshad,Dwarka Sector 10,"Garbage & Waste Management,Road Maintenance"
Priya Sharma,priya.sharma@mcd.gov.in,+919876543211,Deputy Commissioner,Municipal Corporation of Delhi,MCD,South Delhi Zone,"Street Lights & Electricity,Water Supply Issues"
Amit Verma,amit.verma@delhi.gov.in,+919876543212,District Magistrate,Revenue Department,IAS,South Delhi District,"Public Safety & Crime,Illegal Construction"
Sunita Yadav,sunita.yadav@delhi.gov.in,+919876543213,MLA,Legislative Assembly,MLA,Dwarka Constituency,"Traffic & Parking,Sanitation & Public Health"
```

### 4. Import Process

#### Via Mobile App (Admin Panel)

1. Log in as an admin user
2. Navigate to the Admin Panel
3. Click the "Import CSV" button
4. Select your CSV file from your device
5. Wait for the import to complete
6. Review the import results

#### Via API

**Endpoint**: `POST /api/admin/officials/bulk-import-csv`

**Authentication**: Requires admin authentication token

**Request Body**:
```json
{
  "csv_content": "name,email,phone,designation,department,hierarchy_level,area,categories\nRajesh Kumar,rajesh@mcd.gov.in,+919876543210,Ward Councillor,Municipal Corporation,1,Dwarka,\"roads,sanitation\""
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully imported 10 officials",
  "created_count": 10,
  "error_count": 0,
  "created_ids": ["uuid1", "uuid2", ...],
  "errors": []
}
```

**Error Response** (with validation errors):
```json
{
  "success": true,
  "message": "Successfully imported 8 officials",
  "created_count": 8,
  "error_count": 2,
  "created_ids": ["uuid1", "uuid2", ...],
  "errors": [
    {"row": 3, "error": "Name is required"},
    {"row": 5, "error": "Department is required"}
  ]
}
```

### 5. Import Results

After import, you'll see:
- **Created count**: Number of officials successfully imported
- **Error count**: Number of rows that failed validation
- **Error details**: Up to 3 error messages showing which rows failed and why

## Validation Rules

The import process validates:

1. **Required fields**: Name, designation, and department must be present
2. **Hierarchy level**: Must be 1-7 (or valid name like "Parshad", "MCD", etc.)
3. **Email format**: If provided, must be valid email format
4. **Phone format**: If provided, should include country code
5. **Categories**: Must be from the predefined list

## Error Handling

If errors occur during import:
- Successfully validated rows are imported
- Failed rows are reported with row number and error message
- The list refreshes to show newly imported officials
- You can fix errors and re-import failed rows

## Template File

A sample CSV template with 10 example officials is available at:
`backend/officials_template.csv`

You can use this as a starting point and modify it with your data.

## Tips for Large Imports

1. **Test with small batches first**: Import 5-10 officials to ensure your CSV format is correct
2. **Check for duplicates**: The system doesn't check for duplicate officials, so avoid re-importing the same data
3. **Use UTF-8 encoding**: Ensure your CSV file is saved with UTF-8 encoding for proper character support
4. **Quote multi-value fields**: Always put comma-separated categories in quotes (e.g., "roads,sanitation")
5. **Validate emails**: Double-check email addresses to ensure they're valid

## Troubleshooting

### Import fails with "Admin authentication required"
- Ensure you're logged in as an admin user
- Check that your authentication token is valid
- Verify admin status in the database

### Some rows fail with "Name is required"
- Check that all rows have values in the name column
- Ensure there are no empty rows in your CSV

### Categories not appearing
- Make sure categories are in quotes and comma-separated
- Use the exact category names from the list above
- Example: `"Garbage & Waste Management,Road Maintenance"`

### Hierarchy level errors
- Use either numbers (1-7) or names (Parshad, MCD, IAS, MLA, MP, CM, PM)
- Names are case-insensitive
- Default is 1 (Parshad) if not specified

## Security

- Only admin users can import officials
- CSV content is validated before processing
- Failed rows don't stop the entire import
- All imports are logged for audit purposes

## Performance

- Import speed: ~50-100 officials per second
- Recommended batch size: Up to 500 officials per file
- For larger imports (1000+), split into multiple files

## Future Enhancements

Planned improvements:
- [ ] Duplicate detection (by email or name)
- [ ] Update existing officials if email matches
- [ ] Import history and rollback
- [ ] Async processing for very large files (1000+)
- [ ] Export current officials to CSV
- [ ] Import preview before committing

---

## Quick Start

1. Download the template: [backend/officials_template.csv](backend/officials_template.csv)
2. Fill in your official's data
3. Go to Admin Panel in the app
4. Click "Import CSV"
5. Select your file
6. Review the results

That's it! Your officials are now in the system and ready to be assigned to issues.
