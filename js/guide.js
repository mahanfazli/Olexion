document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#FAQ .accordion').forEach(section => {

    const header = section.querySelector('.accordion-header');
    const content = section.querySelector('.accordion-content');

    if (!header || !content) return;

    let isOpen = false;
    let isAnimating = false;

    content.style.height = '0px';
    content.style.overflow = 'hidden';

    function toggle() {
      if (isAnimating) return;
      isAnimating = true;

      if (isOpen) {
        // بستن
        content.style.height = content.scrollHeight + 'px';
        content.offsetHeight; // force reflow
        content.style.height = '0px';
        section.classList.remove('open');
      } else {
        // باز کردن
        content.style.height = content.scrollHeight + 'px';
        section.classList.add('open');
      }

      isOpen = !isOpen;
    }

    header.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select, a, .control-btn')) return;
      toggle();
    });

    content.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'height') return;

      isAnimating = false;

      if (isOpen) {
        content.style.height = 'auto';
      }
    });

  });
});

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
  
      const targetId = this.getAttribute("href");
      const target = document.querySelector(targetId);
  
      if (target) {
        const offset = document.querySelector(".header").offsetHeight;
  
        window.scrollTo({
          top: target.offsetTop - offset,
        });
      }
    });
  });

  