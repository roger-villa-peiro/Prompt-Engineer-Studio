from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("Navigating to http://localhost:3000")
        page.goto('http://localhost:3000')
        
        try:
            print("Waiting for network idle...")
            # Wait for network idle or timeout after 10s if it's polling
            page.wait_for_load_state('networkidle', timeout=10000)
        except Exception as e:
            print(f"Warning: Network idle timeout or error: {e}")
        
        print("Title:", page.title())
        
        # Take a screenshot
        page.screenshot(path='dataset_screenshot.png')
        print("Screenshot saved to dataset_screenshot.png")
        
        # Simple check for content
        content = page.content()
        if "Prompt Engineer Studio" in content or "vite" in content.lower():
             print("SUCCESS: Found expected content.")
        else:
             print("ERROR: Did not find expected content.")
             raise Exception("Content validation failed: 'Prompt Engineer Studio' or 'vite' not found in page content.")
             
        browser.close()

if __name__ == "__main__":
    run()
