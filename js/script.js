const select = document.getElementById("themeSelect");
const themeMeta = document.querySelector('meta[name="theme-color"]');

const themeColors = {
  light: "#ffffff",
  dark: "#1c1c1c",
  "deep-dark": "#09090b",
  midnight: "#1e2127"
};

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  const finalTheme = theme === "auto" ? getSystemTheme() : theme;

  document.documentElement.dataset.theme = finalTheme;

  if (themeMeta && themeColors[finalTheme]) {
    themeMeta.setAttribute("content", themeColors[finalTheme]);
  }
  
  if (typeof refresh !== 'undefined') {
    refresh();
  }
  
}

const savedTheme = localStorage.getItem("theme") || "auto";

select.value = savedTheme;
applyTheme(savedTheme);

select.addEventListener("change", (e) => {
  const value = e.target.value;

  localStorage.setItem("theme", value);
  applyTheme(value);
});

window.matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (localStorage.getItem("theme") === "auto") {
      applyTheme("auto");
    }
});

document.addEventListener('DOMContentLoaded', () => {
  
  const animatedElements = document.querySelectorAll('p ,h1 ,h2, h3, h4, code, img, .fade-up, .fade-right');
  
  const animationConfig = {
    threshold: 0.1,
    rootMargin: '0px 0px 0px 0px'
  };

  function getOriginalFilter(element) {
    const computedStyle = window.getComputedStyle(element);
    const currentFilter = computedStyle.filter;
    if (!currentFilter || currentFilter === 'none') {
      return '';
    }
    return currentFilter;
  }

  function setInitialStyles(element) {
    const animationType = element.dataset.animation || 'fadeRight';
    
    element.dataset.originalFilter = getOriginalFilter(element);
    
    element.style.opacity = '0';
    element.style.transition = 'opacity 0.6s ease, transform 0.6s ease, filter 0.6s ease';
    
    const originalFilter = element.dataset.originalFilter;
    element.style.filter = originalFilter ? `${originalFilter} blur(8px)` : 'blur(8px)';
    
    if (element.tagName === 'IMG') {
      element.style.transform = 'scale(0.7)';
    } else if (animationType === 'fadeUp') {
      element.style.transform = 'translateY(30px) scale(0.5)';
    } else {
      element.style.transform = 'translateX(50px) scale(0.5)';
    }
  }

  function setVisibleStyles(element, delay = 0) {
    setTimeout(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateX(0) translateY(0) scale(1)';
      
      const originalFilter = element.dataset.originalFilter;
      element.style.filter = originalFilter || 'none';
    }, delay);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setVisibleStyles(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, animationConfig);

  animatedElements.forEach(element => {
    setInitialStyles(element);
  });

  setTimeout(() => {
    let delayIndex = 0;
    
    animatedElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      
      if (isVisible) {
        setVisibleStyles(element, delayIndex * 100);
        delayIndex++;
      } else {
        observer.observe(element);
      }
    });
  }, 100);
});

const buttons = document.querySelectorAll('.animate');

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.remove('run');
    void btn.offsetWidth;        
    btn.classList.add('run');
  });
});