/**
 * reveals a password field after it is violently tapped/clicked
 * @param {number} tap_threshold  num times of tap/click required
 * @param {number} time_window  in msec
 * @param {boolean} prevent_zoom  prevent double-tap zoom on mobile
 * @return {Promise<void>}
 */
module.exports = async function revealPassword(
    {
        tap_threshold = 5 , time_window = 1000 , prevent_zoom = true
    } = {}
) {
    const processedInputs = new WeakSet();

    function setupTapDetection(input) {
        if ( processedInputs.has(input) ) return;
        processedInputs.add(input);

        let tapTimes = [];
        let touchStartTime = 0;
        let lastTouchEnd = 0;

        // Unified tap handler for both mouse and touch
        function handleTap() {
            const now = Date.now();
            tapTimes.push(now);

            // Keep only recent taps within the time window
            tapTimes = tapTimes.filter(t => now - t <= time_window);

            if ( tapTimes.length >= tap_threshold ) {
                input.type = input.type === 'password' ? 'text' : 'password';
                tapTimes = []; // Reset after toggle

                // Optional: Add brief visual feedback
                const originalStyle = input.style.backgroundColor;
                input.style.backgroundColor = '#e8f5e8';
                setTimeout(() => {
                    input.style.backgroundColor = originalStyle;
                } , 200);
            }
        }

        // Mouse events (desktop)
        input.addEventListener('click' , handleTap);

        // Touch events (mobile)
        input.addEventListener('touchstart' , (e) => {
            touchStartTime = Date.now();

            // Prevent double-tap zoom if enabled
            if ( prevent_zoom && e.touches.length === 1 ) {
                const now = Date.now();
                if ( now - lastTouchEnd < 300 ) {
                    e.preventDefault();
                }
            }
        } , {passive : false});

        input.addEventListener('touchend' , (e) => {
            const touchDuration = Date.now() - touchStartTime;
            lastTouchEnd = Date.now();

            // Only count as tap if it was a short touch (not a long press)
            if ( touchDuration < 500 && e.changedTouches.length === 1 ) {
                // Prevent the click event from also firing
                e.preventDefault();
                handleTap();
            }
        } , {passive : false});

        // Prevent context menu on long press (optional)
        input.addEventListener('contextmenu' , (e) => {
            if ( tapTimes.length > 0 ) {
                e.preventDefault();
            }
        });

        // Handle focus/blur to reset tap counter if user navigates away
        input.addEventListener('blur' , () => {
            tapTimes = [];
        });
    }

    function scanAndAttach(root = document) {
        if ( ! root.querySelectorAll ) return;
        const elems = root.querySelectorAll('input[type="password"]');
        if ( elems.length > 0 ) console.log('[revealPassword] Found password fields:' , elems);
        elems.forEach(setupTapDetection);
    }

    // Initial scan for existing password fields
    scanAndAttach();

    // Observe future additions to the DOM
    const observer = new MutationObserver(mutations => {
        for ( const mutation of mutations ) {
            mutation.addedNodes.forEach(node => {
                if ( node.nodeType !== 1 ) return; // Skip non-elements

                if ( node.tagName?.toUpperCase() === 'INPUT' && node.type === 'password' ) {
                    setupTapDetection(node);
                } else {
                    scanAndAttach(node);
                }
            });
        }
    });

    observer.observe(document.body , {
        childList : true ,
        subtree : true ,
    });
};
