import * as params from '@params';

let fuse; // holds our search engine
let resList = document.getElementById('search_results');
let sInput = document.getElementById('search_input');
let first, last, current_elem = null
let resultsAvailable = false;

async function initIndex() {
    try {
        const res = await fetch("../index.json");
        if (!res.ok) throw new Error(`index.json HTTP ${res.status}`);
        const data = await res.json();
        if (!data) return;
        // fuse.js options; check fuse.js website for details
        let options = {
            distance: 100,
            threshold: 0.4,
            ignoreLocation: true,
            keys: [
                'title',
                'permalink',
                'summary',
                'content'
            ]
        };
        const s = params?.fuseOpts ?? null;
        if (s) {
            options = {
                isCaseSensitive: s.is_case_sensitive ?? false,
                includeScore: s.include_score ?? false,
                includeMatches: s.include_matches ?? false,
                minMatchCharLength: s.min_match_char_length ?? 1,
                shouldSort: s.should_sort ?? true,
                findAllMatches: s.find_all_matches ?? false,
                keys: s.keys ?? ['title', 'permalink', 'summary', 'content'],
                ignoreLocation: s.ignore_location ?? true,
                location: s.location ?? 0,
                threshold: s.threshold ?? 0.4,
                distance: s.distance ?? 100
            };
        }
        if (typeof Fuse !== 'function') {
            console.error('Fuse.js not loaded before search_ui.js');
            return;
        }
        fuse = new Fuse(data, options); // build the index from the json file
    } catch (err) {
        console.error('Failed to load search index:', err);
    }
}

window.addEventListener('load', initIndex);

function activeToggle(ae) {
    document.querySelectorAll('.focus').forEach(function (element) {
        // rm focus class
        element.classList.remove("focus")
    });
    if (ae) {
        ae.focus()
        current_elem = ae;
        ae.parentElement.classList.add("focus")
    } else {
        document.activeElement.parentElement.classList.add("focus")
    }
}

function reset() {
    resultsAvailable = false;
    resList.innerHTML = sInput.value = ''; // clear inputbox and `#search_results`
    sInput.focus(); // shift focus to input box
}

// --- debounce + IME-safe search ---
function debounce(fn, wait = 180) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
}

let composing = false;
sInput.addEventListener('compositionstart', () => composing = true);
sInput.addEventListener('compositionend',   () => { composing = false; runSearch(); });

const runSearch = debounce(() => {
    if (composing) return;
    const q = sInput.value ? sInput.value.trim() : '';

    if (!q) { reset(); return; }
    if (!fuse || typeof fuse.search !== 'function') { return; }

    let results;
    try {
        const limit = (params && params.fuseOpts && Number.isFinite(params.fuseOpts.limit)) ? params.fuseOpts.limit : undefined;
        results = (limit !== undefined) ? fuse.search(q, { limit }) : fuse.search(q);
    } catch (err) {
        console.error('Fuse search failed:', err);
        resultsAvailable = false;
        resList.innerHTML = '';
        return;
    }

    if (Array.isArray(results) && results.length > 0) {
        let resultSet = '';
        for (let i = 0; i < results.length; i++) {
            const item = results[i].item || {};
            const title = item.title || '';
            const href  = item.permalink || '#';
            resultSet += `<li class="result-item"><span class="indicator" aria-hidden="true"></span>` +
                         `<a class="result-link" href="${href}">${title}</a></li>`;
        }
        resList.innerHTML = resultSet;
        resultsAvailable = true;
        first = resList.firstChild;
        last  = resList.lastChild;
    } else {
        resultsAvailable = false;
        resList.innerHTML = '';
    }
}, 180);

sInput.addEventListener('search', function (e) {
    // clicked on x
    if (!this.value) reset()
})

// Safari/WebKit often fires `input` (not `search`) when clicking the ⓧ clear button
sInput.addEventListener('input', function () {
    if (!this.value) { reset(); return; }
    runSearch();
});

// As a fallback, also handle change-on-blur when the field becomes empty
sInput.addEventListener('change', function (e) {
    if (!this.value) reset()
});

// kb bindings
document.onkeydown = function (e) {
    let key = e.key;
    let ae = document.activeElement;

    let inbox = document.getElementById("searchbox").contains(ae)

    if (ae === sInput) {
        let elements = document.getElementsByClassName('focus');
        while (elements.length > 0) {
            elements[0].classList.remove('focus');
        }
    } else if (current_elem) ae = current_elem;

    if (key === "Escape") {
        reset()
    } else if (!resultsAvailable || !inbox) {
        return
    } else if (key === "ArrowDown") {
        e.preventDefault();
        if (ae == sInput) {
            // if the currently focused element is the search input, focus the <a> of first <li>
            activeToggle(resList.firstChild.lastChild);
        } else if (ae.parentElement != last) {
            // if the currently focused element's parent is last, do nothing
            // otherwise select the next search result
            activeToggle(ae.parentElement.nextSibling.lastChild);
        }
    } else if (key === "ArrowUp") {
        e.preventDefault();
        if (ae.parentElement == first) {
            // if the currently focused element is first item, go to input box
            activeToggle(sInput);
        } else if (ae != sInput) {
            // if the currently focused element is input box, do nothing
            // otherwise select the previous search result
            activeToggle(ae.parentElement.previousSibling.lastChild);
        }
    } else if (key === "ArrowRight") {
        ae.click(); // click on active link
    }
}
