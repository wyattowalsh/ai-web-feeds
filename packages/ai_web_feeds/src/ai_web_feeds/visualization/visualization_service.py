"""Visualization service with business logic.

Implements T021: Chart generation, caching, validation
"""

from datetime import datetime
from typing import Any, Optional

from loguru import logger
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError

from ai_web_feeds.storage import get_session
from ai_web_feeds.visualization.models import (
    ChartType,
    DataSource,
    Visualization,
)
from ai_web_feeds.visualization.data_service import DataService
from ai_web_feeds.visualization.validators import (
    CustomizationValidator,
    ValidationError,
)


class VisualizationService:
    """Service for managing visualizations."""

    def __init__(self):
        """Initialize service."""
        self.data_service = DataService()
        self.customization_validator = CustomizationValidator()

    async def list_visualizations(
        self,
        device_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List all visualizations for a device.

        Args:
            device_id: Device identifier
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of visualization records
        """
        try:
            with get_session() as session:
                statement = (
                    select(Visualization)
                    .where(Visualization.device_id == device_id)
                    .order_by(Visualization.last_viewed.desc())
                    .limit(limit)
                    .offset(offset)
                )

                result = session.execute(statement)
                visualizations = result.scalars().all()

                return [viz.to_dict() for viz in visualizations]
        except Exception as e:
            logger.error(f"Error listing visualizations: {e}")
            return []

    async def create_visualization(
        self,
        device_id: str,
        name: str,
        chart_type: ChartType,
        data_source: DataSource,
        filters: dict[str, Any],
        customization: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a new visualization.

        Args:
            device_id: Device identifier
            name: Visualization name
            chart_type: Type of chart
            data_source: Data source
            filters: Query filters
            customization: Chart customization options

        Returns:
            Created visualization record

        Raises:
            ValidationError: If validation fails
        """
        # Validate customization
        if "title" in customization:
            customization["title"] = self.customization_validator.validate_title(
                customization["title"]
            )

        if "colors" in customization:
            customization["colors"] = self.customization_validator.validate_colors(
                customization["colors"]
            )

        if "font_size" in customization:
            customization["font_size"] = self.customization_validator.validate_font_size(
                customization["font_size"]
            )

        try:
            with get_session() as session:
                visualization = Visualization(
                    device_id=device_id,
                    name=name,
                    chart_type=chart_type,
                    data_source=data_source,
                    filters=filters,
                    customization=customization,
                )

                session.add(visualization)
                session.commit()
                session.refresh(visualization)

                logger.info(f"Created visualization {visualization.id} for device {device_id[:8]}")
                return visualization.to_dict()
        except IntegrityError as e:
            logger.error(f"Integrity error creating visualization: {e}")
            raise ValidationError("Failed to create visualization")
        except Exception as e:
            logger.error(f"Error creating visualization: {e}")
            raise

    async def get_visualization(
        self,
        visualization_id: int,
        device_id: str,
    ) -> Optional[dict[str, Any]]:
        """Get a specific visualization.

        Args:
            visualization_id: Visualization ID
            device_id: Device identifier (for access control)

        Returns:
            Visualization record or None if not found
        """
        try:
            with get_session() as session:
                statement = select(Visualization).where(
                    Visualization.id == visualization_id,
                    Visualization.device_id == device_id,
                )

                result = session.execute(statement)
                visualization = result.scalar_one_or_none()

                if not visualization:
                    return None

                # Update last_viewed timestamp
                visualization.last_viewed = datetime.utcnow()
                session.commit()

                return visualization.to_dict()
        except Exception as e:
            logger.error(f"Error getting visualization {visualization_id}: {e}")
            return None

    async def update_visualization(
        self,
        visualization_id: int,
        device_id: str,
        name: Optional[str] = None,
        filters: Optional[dict[str, Any]] = None,
        customization: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """Update a visualization.

        Args:
            visualization_id: Visualization ID
            device_id: Device identifier (for access control)
            name: New name (optional)
            filters: New filters (optional)
            customization: New customization (optional)

        Returns:
            Updated visualization record or None if not found
        """
        try:
            with get_session() as session:
                statement = select(Visualization).where(
                    Visualization.id == visualization_id,
                    Visualization.device_id == device_id,
                )

                result = session.execute(statement)
                visualization = result.scalar_one_or_none()

                if not visualization:
                    return None

                # Update fields
                if name is not None:
                    visualization.name = name

                if filters is not None:
                    visualization.filters = filters

                if customization is not None:
                    # Validate customization
                    if "title" in customization:
                        customization["title"] = self.customization_validator.validate_title(
                            customization["title"]
                        )

                    if "colors" in customization:
                        customization["colors"] = self.customization_validator.validate_colors(
                            customization["colors"]
                        )

                    visualization.customization = customization

                visualization.last_viewed = datetime.utcnow()

                session.commit()
                session.refresh(visualization)

                logger.info(f"Updated visualization {visualization_id}")
                return visualization.to_dict()
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error updating visualization {visualization_id}: {e}")
            return None

    async def delete_visualization(
        self,
        visualization_id: int,
        device_id: str,
    ) -> bool:
        """Delete a visualization.

        Args:
            visualization_id: Visualization ID
            device_id: Device identifier (for access control)

        Returns:
            True if deleted successfully
        """
        try:
            with get_session() as session:
                statement = delete(Visualization).where(
                    Visualization.id == visualization_id,
                    Visualization.device_id == device_id,
                )

                result = session.execute(statement)
                session.commit()

                deleted = result.rowcount > 0

                if deleted:
                    logger.info(f"Deleted visualization {visualization_id}")
                else:
                    logger.warning(f"Visualization {visualization_id} not found")

                return deleted
        except Exception as e:
            logger.error(f"Error deleting visualization {visualization_id}: {e}")
            return False

    async def fetch_visualization_data(
        self,
        visualization: dict[str, Any],
        date_range: Optional[dict[str, str]] = None,
        limit: int = 1000,
    ) -> dict[str, Any]:
        """Fetch data for a visualization.

        Args:
            visualization: Visualization configuration
            date_range: Date range filter (optional)
            limit: Maximum data points

        Returns:
            Data with metadata
        """
        data_source = visualization["data_source"]
        filters = visualization["filters"]
        device_id = visualization["device_id"]

        try:
            # Query based on data source
            if data_source == "topics":
                topic_ids = filters.get("topic_ids")
                records = self.data_service.query_topic_metrics(
                    topic_ids=topic_ids,
                    date_range=date_range,
                    device_id=device_id,
                    limit=limit,
                )
            elif data_source == "feeds":
                feed_ids = filters.get("feed_ids")
                records = self.data_service.query_feed_health(
                    feed_ids=feed_ids,
                    date_range=date_range,
                    device_id=device_id,
                    limit=limit,
                )
            else:
                # Other data sources can be added here
                records = []

            return {
                "records": records,
                "count": len(records),
                "data_source": data_source,
                "filters": filters,
                "date_range": date_range,
            }
        except Exception as e:
            logger.error(f"Error fetching visualization data: {e}")
            return {
                "records": [],
                "count": 0,
                "error": str(e),
            }
