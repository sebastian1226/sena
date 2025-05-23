// Abrir modales
document.querySelectorAll('button[data-modal]').forEach(button => {
  button.addEventListener('click', () => {
    const modal = document.getElementById(button.dataset.modal);
    modal.classList.add('active');
  });
});

// Cerrar modales
document.querySelectorAll('[data-close]').forEach(closeBtn => {
  closeBtn.addEventListener('click', () => {
    closeBtn.closest('.modal').classList.remove('active');
  });
});

// Cambiar tema
document.getElementById('toggle-theme').addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
});

// Cambiar idioma (solo efecto visual en consola)
document.getElementById('language-select').addEventListener('change', (e) => {
  const lang = e.target.value;
  alert(lang === 'es' ? 'Idioma cambiado a Español' : 'Language changed to English');
});

// Formularios - mostrar alerta de guardado
document.querySelectorAll('.modal form').forEach(form => {
  form.addEventListener('submit', e => {
    e.preventDefault();
    alert('Configuración guardada exitosamente.');
    form.closest('.modal').classList.remove('active');
    form.reset();
  });
});
