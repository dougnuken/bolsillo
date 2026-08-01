/* Sonda de viewport para bisección. Se inyecta en una COPIA de index.html.
   Todo por CSSOM y sin <style> ni atributo style: la CSP de index.html declara
   style-src 'self' y script-src 'self', así que un <style> inline se bloquea
   (fue justo lo que dejó a medirLvh() midiendo 0 durante varias versiones). */
(() => {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = './probe.css?v=1';
  document.head.appendChild(css);

  const caja = document.createElement('div');
  caja.className = 'probe-panel';
  caja.innerHTML = '<b>' + (document.title || 'sonda') + '</b><pre id="probe-out">midiendo…</pre>';
  const medidor = document.createElement('div');
  medidor.className = 'probe-lvh';
  document.body.appendChild(medidor);
  document.body.appendChild(caja);

  const alto = (cls) => { medidor.className = 'probe-lvh ' + cls;
                          return Math.round(medidor.getBoundingClientRect().height); };
  let maxInner = 0;
  const pintar = () => {
    const inner = Math.round(innerHeight);
    maxInner = Math.max(maxInner, inner);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    document.getElementById('probe-out').textContent =
      `screen    ${screen.height}\n` +
      `inner     ${inner}\n` +
      `svh       ${alto('is-svh')}\n` +
      `lvh       ${alto('is-lvh')}\n` +
      `dvh       ${alto('is-dvh')}\n` +
      `FALTA     ${screen.height - inner} pt\n` +
      `modo      ${standalone ? 'INSTALADA' : '⚠️ NAVEGADOR'}\n` +
      `máx inner ${maxInner}`;
  };
  pintar();
  addEventListener('resize', pintar);
  addEventListener('scroll', pintar, { passive: true });
  if (window.visualViewport) visualViewport.addEventListener('resize', pintar);
  setInterval(pintar, 300);
})();
