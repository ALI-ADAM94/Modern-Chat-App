## REST API

- POST /api/auth/register - {username, email, password}
- POST /api/auth/login - {email, password} => {token , user}
- GET /api/rooms (Auth) - قائمة الغرف (بدون المحادثات الخاصة)
- POST /api/rooms (Auth) - {name, description? , isPrivate} (المنشئ يضاف للأعضاء)
- GET /api/rooms/:id (Auth) - تفاصيل الغرفة
- GET /api/rooms/:id/messages (Auth) - ?limit=50&skip=0 (الأحدث أولا، الغرف الخاصة للأعضاء فقط)
- POST /api/rooms/direct/:userId (Auth) - فتح / إنشاء محادثة خاصة مع مستخدم => room
- GET /api/users (Auth) - قائمة المستخدمين ?search=ali => [{_id, username, displayName, avatar, about, lastSeen, online}]
- GET /api/users/me (Auth) - حسابي
- PATCH /api/users/me (Auth) - {displayName?, username?, email?, about?, avatar?} (avatar = url من /api/upload او "" للحذف)
- PATCH /api/users/me/password (Auth) - {currentPassword, newPassword}
- POST /api/upload (Auth) - multipart/form-data حقل "file" (حد اقصى 10MB) => {url, name, mimeType, size, isImage}
- GET /uploads/<file> - الصور تعرض مباشرة، باقي الملفات تحميل فقط

Auth = header `Authorization: Bearer <token>`


## Socket.io (الاتصال مع التوكين)

الاتصال: `io(url, { auth: { token } })` — لو التوكين غلط بيوصل `connect_error`

### من العميل للسيرفر
- join-room - {roomId} => السيرفر هيرد joined-room {roomId}
- leave-room - {roomId}
- send-message - {roomId, text?, attachment?} (attachment = الرد من /api/upload، لازم تكون منضم للغرفة)
- edit-message - {messageId, text} (صاحب الرسالة فقط)
- delete-message - {messageId} (صاحب الرسالة فقط)
- typing-start - {roomId}
- typing-stop - {roomId}

### من السيرفر للعميل
- joined-room - {roomId}
- new-message - رسالة كاملة {_id, room, text, attachment, editedAt, deleted, createdAt, user {_id, username, displayName, avatar}}
- message-updated - {_id, room, text, editedAt}
- message-deleted - {_id, room}
- user-updated - {_id, username, displayName, avatar, about} (تغيير الملف الشخصي)
- user-typing / user-stop-typing - {roomId, userId, username}
- online-users - [userId] (عند الاتصال)
- user-online - {userId, username}
- user-offline - {userId, lastSeen}
- error - نص الخطأ
