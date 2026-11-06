// Interacción de muestra: no crea tareas ni concede estrellas reales.
document.querySelectorAll('.demo-check').forEach(button => button.addEventListener('click', () => {
    button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') !== 'true');
    const count = document.querySelectorAll('.demo-check[aria-pressed="true"]').length;
    document.getElementById('demo-stars').textContent = '⭐ ' + count * 10 + ' estrellas';
    document.getElementById('demo-feedback').textContent = count === 2 ? '🎉 ¡Dos misiones cumplidas! Así se siente avanzar.' : count === 1 ? '⭐ ¡Lo conseguiste! Un pequeño paso, 10 estrellas de ejemplo.' : '🌱 Cada pequeño paso cuenta. ¿Probamos el primero?';
}));
