document.addEventListener('DOMContentLoaded', () => {
    // Hamburger menu toggle
    const hamburger = document.querySelector('.hamburger');
    const body = document.body;

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            body.classList.toggle('mobile-open');
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 72, // Adjust for sticky header height
                    behavior: 'smooth'
                });
                // Close mobile menu if open
                if (body.classList.contains('mobile-open')) {
                    body.classList.remove('mobile-open');
                }
            }
        });
    });

    // Scroll Reveal Animation
    const revealElements = document.querySelectorAll('.reveal');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1 // Trigger when 10% of the element is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => observer.observe(el));

    // Count-up Animation for Stats
    const countUpElements = document.querySelectorAll('.count-up');

    const countUpObserverOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5 // Trigger when 50% of the element is visible
    };

    const countUpObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.dataset.target);
                let current = 0;
                const increment = target / 200; // Adjust duration

                const updateCount = () => {
                    if (current < target) {
                        current += increment;
                        entry.target.textContent = Math.floor(current);
                        requestAnimationFrame(updateCount);
                    } else {
                        entry.target.textContent = target;
                    }
                };
                updateCount();
                observer.unobserve(entry.target);
            }
        });
    }, countUpObserverOptions);

    countUpElements.forEach(el => countUpObserver.observe(el));
});
