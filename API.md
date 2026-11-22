## REST API

- POST /api/auth/register - {username, email, password}
- POST /api/auth/login - {email, password} => {token , user}
- GET /api/rooms (Auth) - قائمة الغرف (بدون المحادثات الخاصة)
- POST /api/rooms (Auth) - {name, description? , isPrivate} (المنشئ يضاف للأعضاء)
- GET /api/rooms/:id (Auth) - تفاصيل الغرفة
- GET /api/rooms/:id/messages (Auth) - ?limit=50&skip=0 (الأحدث أولا، الغرف الخاصة للأعضاء فقط)
- POST /api/rooms/direct/:userId (Auth) - فتح / إنشاء محادثة خاصة مع مستخدم => room
- GET /api/users (Auth) - قائمة المستخدمين => [{_id, username, displayName, avatar, lastSeen, online}]

Auth = header `Authorization: Bearer <token>`


## Socket.io (الاتصال مع التوكين)

الاتصال: `io(url, { auth: { token } })` — لو التوكين غلط بيوصل `connect_error`

### من العميل للسيرفر
- join-room - {roomId} => السيرفر هيرد joined-room {roomId}
- leave-room - {roomId}
- send-message - {roomId, text} (لازم تكون منضم للغرفة)
- typing-start - {roomId}
- typing-stop - {roomId}

### من السيرفر للعميل
- joined-room - {roomId}
- new-message - رسالة كاملة مع user {_id, username, displayName}
- user-typing / user-stop-typing - {roomId, userId, username}
- online-users - [userId] (عند الاتصال)
- user-online - {userId, username}
- user-offline - {userId, lastSeen}
- error - نص الخطأ
