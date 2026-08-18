# Amendment — уведомления о регистрации гостей в админке

Date: 2026-08-18
Status: Approved concept amendment

## Goal

Notify the single owner/admin immediately when a guest successfully registers for the second-day wedding event.

The admin should not need to refresh the guest list manually. New registrations must appear in realtime on the admin phone UI.

## In-app realtime notification

After a guest registration transaction succeeds:

1. The guest record is committed to Supabase.
2. Owner/admin clients subscribed to guest registration changes receive the new guest in realtime.
3. Admin guest list updates immediately.
4. A compact toast/banner appears at the top of the admin UI.

Suggested notification content:

`НОВЫЙ ПАССАЖИР`  
`Иван Петров · Вагон №3`  
`со стороны Виктора`

The carriage color should be used as a small visual marker in the notification.

## Notification behavior

- Notifications are owner-only.
- No guest, Liza, Viktor, projector, or public route may subscribe to the complete registration feed.
- Multiple registrations arriving close together should queue cleanly rather than replace one another.
- The toast should remain visible long enough to notice, then dismiss automatically.
- Admin can tap the notification to open/focus the corresponding guest record in the registered guest list.
- The guest counter in admin updates at the same time, e.g. `Зарегистрировано: 27`.

## Optional attention cues

The admin UI should support an optional restrained sound and/or vibration cue on supported mobile browsers.

Default behavior for MVP:

- visual toast enabled
- subtle sound optional and user-toggleable
- no loud repeated alert

Browser/OS push notifications are not required for the initial MVP. They may be added later if background notifications are needed when the site is not open.

## Duplicate handling integration

If the owner later deletes a duplicate guest, the registration notification remains only as transient UI history; deleting a guest does not generate a second public announcement.

If duplicate detection flags a likely duplicate during registration, the owner may also see a small warning badge in the guest list, but the registration should still be visible immediately.

## Security

- Only the authenticated owner/admin account may read the complete guest registration feed.
- Realtime database policies must enforce owner-only access; hiding the UI is not sufficient.
- Guest-facing routes can read only the registration data necessary for their own profile/ticket.

## Testing requirements

- New registration appears in the owner's guest list without manual refresh.
- Exactly one admin toast is emitted for one successful registration.
- Multiple near-simultaneous registrations are all shown.
- Non-owner clients cannot subscribe to the full registration stream.
- Tapping the toast opens the correct guest record.
- Guest count stays consistent after registration and owner deletion of duplicates.

## Acceptance criteria

1. Owner sees a new guest registration within realtime latency while the admin page is open.
2. Notification clearly shows guest name and carriage/team.
3. The complete registration feed remains private to the owner/admin.
4. No page refresh is required.
