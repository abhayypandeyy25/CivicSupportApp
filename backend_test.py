#!/usr/bin/env python3
"""
CivicSense Backend API Testing Script
Tests all public endpoints without authentication
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://civicwatch-21.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.results = []
        self.total_tests = 0
        self.passed_tests = 0
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        self.total_tests += 1
        if success:
            self.passed_tests += 1
            
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        
        if response_data:
            result["response_sample"] = response_data
            
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()

    def test_health_check(self):
        """Test GET /api/health"""
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_result("Health Check", True, "Returns healthy status", data)
                else:
                    self.log_result("Health Check", False, "Invalid response format", data)
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}", response.text[:200])
                
        except Exception as e:
            self.log_result("Health Check", False, f"Request failed: {str(e)}")

    def test_categories(self):
        """Test GET /api/categories"""
        try:
            response = requests.get(f"{BACKEND_URL}/categories", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "categories" in data and isinstance(data["categories"], list):
                    categories = data["categories"]
                    if len(categories) == 12:
                        self.log_result("Categories Endpoint", True, f"Returns {len(categories)} categories", 
                                      {"count": len(categories), "sample": categories[:3]})
                    else:
                        self.log_result("Categories Endpoint", False, 
                                      f"Expected 12 categories, got {len(categories)}", data)
                else:
                    self.log_result("Categories Endpoint", False, "Invalid response format", data)
            else:
                self.log_result("Categories Endpoint", False, f"HTTP {response.status_code}", response.text[:200])
                
        except Exception as e:
            self.log_result("Categories Endpoint", False, f"Request failed: {str(e)}")

    def test_officials_list(self):
        """Test GET /api/officials"""
        try:
            response = requests.get(f"{BACKEND_URL}/officials", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Officials List", True, f"Returns {len(data)} officials", 
                                  {"count": len(data), "sample": data[:2] if data else []})
                else:
                    self.log_result("Officials List", False, "Expected list response", data)
            else:
                self.log_result("Officials List", False, f"HTTP {response.status_code}", response.text[:200])
                
        except Exception as e:
            self.log_result("Officials List", False, f"Request failed: {str(e)}")

    def test_officials_hierarchy(self):
        """Test GET /api/officials/hierarchy"""
        try:
            response = requests.get(f"{BACKEND_URL}/officials/hierarchy", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check for 7 hierarchy levels
                    levels = [item.get("level") for item in data]
                    expected_levels = list(range(1, 8))  # 1 to 7
                    
                    if len(data) == 7 and all(level in expected_levels for level in levels):
                        total_officials = sum(item.get("count", 0) for item in data)
                        self.log_result("Officials Hierarchy", True, 
                                      f"Returns 7 hierarchy levels with {total_officials} total officials", 
                                      {"levels": len(data), "total_officials": total_officials, "sample": data[:2]})
                    else:
                        self.log_result("Officials Hierarchy", False, 
                                      f"Expected 7 levels (1-7), got levels: {levels}", data)
                else:
                    self.log_result("Officials Hierarchy", False, "Expected list response", data)
            else:
                self.log_result("Officials Hierarchy", False, f"HTTP {response.status_code}", response.text[:200])
                
        except Exception as e:
            self.log_result("Officials Hierarchy", False, f"Request failed: {str(e)}")

    def test_specific_official(self):
        """Test GET /api/officials/{official_id} - first get an official ID"""
        try:
            # First get list of officials to get an ID
            response = requests.get(f"{BACKEND_URL}/officials", timeout=10)
            
            if response.status_code == 200:
                officials = response.json()
                if officials and len(officials) > 0:
                    official_id = officials[0].get("id")
                    if official_id:
                        # Test specific official endpoint
                        detail_response = requests.get(f"{BACKEND_URL}/officials/{official_id}", timeout=10)
                        
                        if detail_response.status_code == 200:
                            official_data = detail_response.json()
                            if "id" in official_data and official_data["id"] == official_id:
                                self.log_result("Specific Official", True, 
                                              f"Returns official details for ID: {official_id}", 
                                              {"name": official_data.get("name"), "designation": official_data.get("designation")})
                            else:
                                self.log_result("Specific Official", False, "Invalid official data", official_data)
                        else:
                            self.log_result("Specific Official", False, 
                                          f"HTTP {detail_response.status_code}", detail_response.text[:200])
                    else:
                        self.log_result("Specific Official", False, "No official ID found in list")
                else:
                    self.log_result("Specific Official", False, "No officials found to test with")
            else:
                self.log_result("Specific Official", False, f"Failed to get officials list: HTTP {response.status_code}")
                
        except Exception as e:
            self.log_result("Specific Official", False, f"Request failed: {str(e)}")

    def test_issues_list(self):
        """Test GET /api/issues"""
        try:
            response = requests.get(f"{BACKEND_URL}/issues", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Issues List", True, f"Returns {len(data)} issues", 
                                  {"count": len(data), "sample": data[:1] if data else []})
                else:
                    self.log_result("Issues List", False, "Expected list response", data)
            else:
                self.log_result("Issues List", False, f"HTTP {response.status_code}", response.text[:200])
                
        except Exception as e:
            self.log_result("Issues List", False, f"Request failed: {str(e)}")

    def test_issues_category_filter(self):
        """Test GET /api/issues?category=roads"""
        try:
            response = requests.get(f"{BACKEND_URL}/issues?category=roads", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check if all returned issues have category 'roads' (if any)
                    if data:
                        roads_issues = [issue for issue in data if issue.get("category") == "roads"]
                        if len(roads_issues) == len(data):
                            self.log_result("Issues Category Filter", True, 
                                          f"Returns {len(data)} roads issues", {"count": len(data)})
                        else:
                            self.log_result("Issues Category Filter", False, 
                                          f"Filter not working: {len(roads_issues)}/{len(data)} are roads issues")
                    else:
                        self.log_result("Issues Category Filter", True, "No roads issues found (empty result is valid)")
                else:
                    self.log_result("Issues Category Filter", False, "Expected list response", data)
            else:
                self.log_result("Issues Category Filter", False, f"HTTP {response.status_code}", response.text[:200])
                
        except Exception as e:
            self.log_result("Issues Category Filter", False, f"Request failed: {str(e)}")

    def test_issues_location_filter(self):
        """Test GET /api/issues with location filter (Delhi coordinates)"""
        try:
            # Delhi coordinates
            params = {
                "latitude": 28.6139,
                "longitude": 77.2090,
                "radius_km": 10
            }
            response = requests.get(f"{BACKEND_URL}/issues", params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Issues Location Filter", True, 
                                  f"Returns {len(data)} issues within 10km of Delhi", {"count": len(data)})
                else:
                    self.log_result("Issues Location Filter", False, "Expected list response", data)
            else:
                self.log_result("Issues Location Filter", False, f"HTTP {response.status_code}", response.text[:200])
                
        except Exception as e:
            self.log_result("Issues Location Filter", False, f"Request failed: {str(e)}")

    def test_stats(self):
        """Test GET /api/stats"""
        try:
            response = requests.get(f"{BACKEND_URL}/stats", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_fields = ["total_issues", "pending_issues", "resolved_issues", "total_users", "total_officials"]
                
                if all(field in data for field in expected_fields):
                    self.log_result("Stats Endpoint", True, "Returns all required statistics", 
                                  {field: data[field] for field in expected_fields})
                else:
                    missing = [field for field in expected_fields if field not in data]
                    self.log_result("Stats Endpoint", False, f"Missing fields: {missing}", data)
            else:
                self.log_result("Stats Endpoint", False, f"HTTP {response.status_code}", response.text[:200])
                
        except Exception as e:
            self.log_result("Stats Endpoint", False, f"Request failed: {str(e)}")

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting CivicSense Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Run all tests
        self.test_health_check()
        self.test_categories()
        self.test_officials_list()
        self.test_officials_hierarchy()
        self.test_specific_official()
        self.test_issues_list()
        self.test_issues_category_filter()
        self.test_issues_location_filter()
        self.test_stats()
        
        # Print summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.total_tests - self.passed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests)*100:.1f}%")
        
        if self.passed_tests == self.total_tests:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed. Check details above.")
            
        return self.results

if __name__ == "__main__":
    tester = BackendTester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open("/app/backend_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")