"""Unit tests for the replaceable notification sender seam."""

import pytest
from ai_web_feeds.notifications import (
    NotificationPayload,
    RecordingNotificationSender,
    deliver_notification,
    notification_sender,
)


class FakeNotificationSender:
    """Records delivery attempts without contacting a server."""

    def __init__(self) -> None:
        self.recorded: list[NotificationPayload] = []

    def send(self, payload: NotificationPayload) -> None:
        """Store the payload that would have been sent."""
        self.recorded.append(payload)


@pytest.mark.unit
def test_fake_sender_records_one_payload_and_import_sends_no_mail() -> None:
    """Constructing the module sender must not send mail; a fake records one payload."""
    constructed = RecordingNotificationSender()
    assert constructed.recorded == []
    assert constructed.mail_sent == 0
    assert notification_sender.recorded == []
    assert notification_sender.mail_sent == 0

    payload = NotificationPayload(
        user_id="user-1",
        title="Feed updated",
        message="One new article",
        notification_type="feed_updated",
    )
    fake = FakeNotificationSender()
    deliver_notification(payload, sender=fake)

    assert fake.recorded == [payload]
    assert len(fake.recorded) == 1
    assert constructed.recorded == []
    assert constructed.mail_sent == 0
    assert notification_sender.recorded == []
    assert notification_sender.mail_sent == 0
