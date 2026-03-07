export async function get(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export function streamTrigger(path, onLine, onDone) {
  const ctrl = new AbortController();
  fetch(path, { method: 'POST', signal: ctrl.signal })
    .then(res => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      function pump() {
        reader.read().then(({ done, value }) => {
          if (done) { onDone(0); return; }
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            try {
              const msg = JSON.parse(line.slice(5).trim());
              if (msg.type === 'log') onLine(msg.text);
              if (msg.type === 'done') onDone(msg.code);
            } catch {}
          }
          pump();
        });
      }
      pump();
    })
    .catch(err => { if (err.name !== 'AbortError') onDone(1); });
  return () => ctrl.abort();
}
