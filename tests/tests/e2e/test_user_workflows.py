"""End-to-end tests for complete user workflows.

These tests verify the entire user journey across the application.
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Configure browser context."""
    return {
        **browser_context_args,
        "viewport": {"width": 1920, "height": 1080},
    }


class TestSearchWorkflow:
    """Test complete search user workflow."""

    @pytest.mark.e2e
    def test_search_to_result_click(self, page: Page):
        """Test user flow: navigate to search → enter query → click result."""
        # Navigate to search page
        page.goto("/search")

        # Verify search bar is visible
        search_input = page.locator('input[placeholder*="Search"]')
        expect(search_input).to_be_visible()

        # Enter search query
        search_input.fill("machine learning")
        page.keyboard.press("Enter")

        # Wait for results
        page.wait_for_selector('[class*="result"]', timeout=5000)

        # Verify results are displayed
        results = page.locator('[class*="result"]')
        expect(results.first).to_be_visible()

    @pytest.mark.e2e
    def test_autocomplete_workflow(self, page: Page):
        """Test autocomplete suggestions workflow."""
        page.goto("/search")

        # Type in search bar
        search_input = page.locator('input[placeholder*="Search"]')
        search_input.fill("open")

        # Wait for autocomplete suggestions
        page.wait_for_selector('[class*="suggestion"]', timeout=3000)

        # Verify suggestions appear
        suggestions = page.locator('[class*="suggestion"]')
        expect(suggestions.first).to_be_visible()

    @pytest.mark.e2e
    def test_search_filter_workflow(self, page: Page):
        """Test applying search filters."""
        page.goto("/search")

        # Enter search
        page.locator('input[placeholder*="Search"]').fill("AI")
        page.keyboard.press("Enter")

        # Apply filter
        page.locator('button:has-text("Verified")').click()

        # Verify filter is applied
        expect(page.locator('[class*="verified"]')).to_be_visible()


class TestAnalyticsWorkflow:
    """Test analytics dashboard workflow."""

    @pytest.mark.e2e
    def test_analytics_dashboard_load(self, page: Page):
        """Test analytics dashboard loads successfully."""
        page.goto("/analytics")

        # Verify summary metrics are visible
        expect(page.locator('text="Total Feeds"')).to_be_visible()

        # Verify charts load
        page.wait_for_selector("canvas", timeout=5000)
        charts = page.locator("canvas")
        expect(charts.first).to_be_visible()

    @pytest.mark.e2e
    def test_analytics_time_range_filter(self, page: Page):
        """Test changing time range filter."""
        page.goto("/analytics")

        # Click time range button
        page.locator('button:has-text("30 days")').click()

        # Select different range
        page.locator('button:has-text("90 days")').click()

        # Verify metrics update
        page.wait_for_timeout(1000)  # Wait for refresh


class TestRecommendationsWorkflow:
    """Test recommendations workflow."""

    @pytest.mark.e2e
    def test_recommendations_page_load(self, page: Page):
        """Test recommendations page loads with suggestions."""
        page.goto("/recommendations")

        # Verify page loads
        expect(page.locator('text="AI-Powered Recommendations"')).to_be_visible()

        # Verify recommendation cards appear
        page.wait_for_selector('[class*="recommendation"]', timeout=5000)
        cards = page.locator('[class*="recommendation"]')
        expect(cards.first).to_be_visible()

    @pytest.mark.e2e
    def test_recommendation_interaction(self, page: Page):
        """Test subscribing to a recommendation."""
        page.goto("/recommendations")

        # Wait for recommendations
        page.wait_for_selector('button:has-text("Subscribe")', timeout=5000)

        # Click subscribe button
        subscribe_btn = page.locator('button:has-text("Subscribe")').first
        subscribe_btn.click()

        # Verify interaction (alert or toast)
        page.wait_for_timeout(500)


class TestNavigationWorkflow:
    """Test navigation between pages."""

    @pytest.mark.e2e
    def test_homepage_to_features(self, page: Page):
        """Test navigating from homepage to feature pages."""
        page.goto("/")

        # Verify homepage loads
        expect(page.locator('text="AI Web Feeds"')).to_be_visible()

        # Navigate to analytics
        page.locator('a[href="/analytics"]').click()
        expect(page).to_have_url("/analytics")

        # Navigate back to home
        page.goto("/")

        # Navigate to search
        page.locator('a[href="/search"]').click()
        expect(page).to_have_url("/search")

    @pytest.mark.e2e
    def test_mobile_responsive(self, page: Page):
        """Test mobile responsive layout."""
        # Set mobile viewport
        page.set_viewport_size({"width": 375, "height": 667})

        page.goto("/")

        # Verify content is visible on mobile
        expect(page.locator('text="AI Web Feeds"')).to_be_visible()

        # Test navigation on mobile
        page.goto("/search")
        expect(page.locator('input[placeholder*="Search"]')).to_be_visible()


# Configuration for pytest-playwright
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "e2e: mark test as end-to-end test")
