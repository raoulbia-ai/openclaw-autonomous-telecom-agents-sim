# SENTINEL-FAST.md - Quick Health Check Playbook

Run these steps:

1. **Check Gateway Status**
   - `openclaw gateway status`

2. **Check Agent Status**
   - `openclaw status`

3. **Check Recent Logs**
   - Check logs for errors in last 30 minutes

4. **Report Status**
   - Return "HEARTBEAT_OK" if all clear, otherwise alert with details

---

If nothing needs attention, reply: HEARTBEAT_OK
