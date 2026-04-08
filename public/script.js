// --- 1. GLOBAL VARIABLES & API SETUP ---
const API_KEY = '8f02636bbe41a72ee649f2d29dd5a4eb';
const IMG_PATH = 'https://image.tmdb.org/t/p/w500';

let currentActiveMovieId = null; 
let lastOpenedMovieId = null;       
let isViewingFilteredGrid = false;  
let myWatchlist = JSON.parse(localStorage.getItem('cinevault_watchlist')) || [];

// --- NEW: AUTHENTICATION STATE ---
let currentUser = localStorage.getItem("cinevault_user");
let authToken = localStorage.getItem("cinevault_token");

// Check Auth Status on Load
window.onload = () => {
    if (currentUser && authToken) {
        document.getElementById("auth-btn").innerText = `Logout (${currentUser})`;
        document.getElementById("auth-btn").style.background = "#333";
        document.getElementById("watchlist-btn").style.display = "inline-block";
    }
};

// --- AUTH UI FUNCTIONS ---
function openAuthModal() {
    if (currentUser) {
        // Logout Logic
        localStorage.removeItem("cinevault_user");
        localStorage.removeItem("cinevault_token");
        currentUser = null;
        authToken = null;
        alert("Logged out successfully.");
        window.location.reload();
    } else {
        document.getElementById("auth-modal-overlay").style.display = "flex";
    }
}

function closeAuthModal() {
    document.getElementById("auth-modal-overlay").style.display = "none";
}

function toggleAuthView(view) {
    if (view === 'register') {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("register-section").style.display = "block";
    } else {
        document.getElementById("register-section").style.display = "none";
        document.getElementById("login-section").style.display = "block";
    }
}

// --- API AUTH CALLS ---
async function handleRegister() {
    const user = document.getElementById("reg-username").value;
    const pass = document.getElementById("reg-password").value;
    if (!user || !pass) return alert("Please fill in both fields!");

    const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    });
    const data = await res.json();
    alert(data.message || data.error);
    if (res.ok) toggleAuthView('login');
}

async function handleLogin() {
    const user = document.getElementById("login-username").value;
    const pass = document.getElementById("login-password").value;
    if (!user || !pass) return alert("Please fill in both fields!");

    const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    });
    const data = await res.json();
    
    if (res.ok) {
        // SAVE VIP TOKEN
        localStorage.setItem("cinevault_token", data.token);
        localStorage.setItem("cinevault_user", data.username);
        currentUser = data.username;
        authToken = data.token;
        alert("Welcome to CineVault, " + currentUser + "!");
        window.location.reload();
    } else {
        alert(data.error);
    }
}


// --- 2. CORE FETCHING & DISPLAY ---
async function getMovies() {
    const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}`);
    const data = await res.json();
    displayMovies(data.results);
}

function displayMovies(movies) {
    const container = document.getElementById("movies");
    container.innerHTML = ""; 
    if (movies.length === 0) return container.innerHTML = "<h2 style='color: white; width: 100%; text-align: center;'>No movies found. Try another search!</h2>";

    movies.forEach(movie => {
        const div = document.createElement("div");
        div.classList.add("movie-card"); 
        div.setAttribute("onclick", `viewMovieDetails(${movie.id})`);
        const ratingDisplay = typeof movie.vote_average === 'number' ? movie.vote_average.toFixed(1) : movie.vote_average;

        div.onmouseenter = async () => {
            const bg = document.getElementById('dynamic-bg');
            bg.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${movie.backdrop_path}')`;
            bg.style.opacity = "1";
            const hoverBox = div.querySelector('.hover-details');
            if (hoverBox.dataset.loaded === "false") {
                hoverBox.innerHTML = "<span>Loading...</span>";
                try {
                    const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${API_KEY}`);
                    const credits = await res.json();
                    const director = credits.crew.find(c => c.job === "Director")?.name || "Unknown";
                    const cast = credits.cast.slice(0, 3).map(a => a.name).join(", ");
                    hoverBox.innerHTML = `<strong>Dir:</strong> ${director}<br><strong style="color:var(--lb-green);">Cast:</strong> ${cast}`;
                    hoverBox.dataset.loaded = "true";
                } catch (e) {
                    hoverBox.innerHTML = "<span>Info unavailable</span>";
                }
            }
        };

        div.onmouseleave = () => document.getElementById('dynamic-bg').style.opacity = "0";

        div.innerHTML = `
            <img src="${IMG_PATH + movie.poster_path}" alt="${movie.title}">
            <div class="info-overlay">
                <h3>${movie.title}</h3>
                <span class="rating-pill">⭐ ${ratingDisplay}/10</span>
                <div class="hover-details" data-loaded="false"></div>
            </div>
        `;
        container.appendChild(div);
    });
}
getMovies(); 

// --- 3. SMART ROUTING & NAVIGATION ---
function onHeaderClick() {
    document.getElementById("ai-container").style.display = "flex"; 
    document.getElementById("booking-page").style.display = "none";
    const isGridVisible = document.getElementById("movies").style.display !== "none";
    if (isGridVisible && isViewingFilteredGrid && lastOpenedMovieId) {
        document.querySelector("h1").innerText = "🎬 CineVault";
        viewMovieDetails(lastOpenedMovieId);
        isViewingFilteredGrid = false; 
    } else { goHome(); }
}

function goHome() {
    closeDetails();
    isViewingFilteredGrid = false; 
    document.querySelector("h1").innerText = "🎬 CineVault";
    document.getElementById("movies").innerHTML = "<h2 style='text-align:center; color:white; width: 100%;'>Loading...</h2>";
    document.getElementById("searchInput").value = ""; 
    document.getElementById("aiInput").value = ""; 
    document.getElementById("booking-page").style.display = "none";
    getMovies(); 
}

function closeDetails() {
    document.getElementById("movie-details").style.display = "none";
    document.getElementById("movies").style.display = "grid";
    document.getElementById("search-container").style.display = "flex"; 
}

// --- 4. 🤖 ADVANCED AI CINEPHILE ENGINE ---
function handleAISearch(event) { if (event.key === "Enter") aiRecommend(); }
async function aiRecommend() {
    const query = document.getElementById("aiInput").value.toLowerCase();
    if (!query) return;
    closeDetails(); 
    isViewingFilteredGrid = true;
    lastOpenedMovieId = null; 
    document.querySelector("h1").innerText = `🤖 AI Results for: "${query}"`;
    document.getElementById("movies").innerHTML = "<h2 style='text-align:center; color:white; width: 100%;'>AI is analyzing data points...</h2>";

    try {
        let url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc`;
        const genreMap = {
            "action": 28, "explosion": 28, "chase": 28, "martial arts": 28,
            "comedy": 35, "funny": 35, "laugh": 35, "hilarious": 35, "goofy": 35,
            "horror": 27, "scary": 27, "spooky": 27, "terrifying": 27, "creepy": 27,
            "sci-fi": 878, "space": 878, "alien": 878, "future": 878, "cyberpunk": 878,
            "romance": 10749, "love": 10749, "dating": 10749, "couple": 10749,
            "drama": 18, "sad": 18, "emotional": 18, "cry": 18,
            "thriller": 53, "suspense": 53, "twist": 53, "mystery": 9648,
            "animation": 16, "cartoon": 16, "anime": 16,
            "crime": 80, "mafia": 80, "heist": 80, "murder": 80,
            "war": 10752, "military": 10752, "soldier": 10752,
            "music": 10402, "musical": 10402, "singing": 10402
        };
        let selectedGenres = [];
        for (let key in genreMap) { if (query.includes(key) && !selectedGenres.includes(genreMap[key])) selectedGenres.push(genreMap[key]); }
        if (selectedGenres.length > 0) url += `&with_genres=${selectedGenres.join(",")}`;

        const yearMatch = query.match(/\b(19\d{2}|20\d{2})\b/); 
        const decadeMatch = query.match(/\b(70s|80s|90s|00s|10s|20s)\b/); 
        if (yearMatch) url += `&primary_release_year=${yearMatch[0]}`;
        else if (decadeMatch) {
            const d = decadeMatch[0]; let sy, ey;
            if (d === "70s") { sy=1970; ey=1979; } else if (d === "80s") { sy=1980; ey=1989; } else if (d === "90s") { sy=1990; ey=1999; } else if (d === "00s") { sy=2000; ey=2009; } else if (d === "10s") { sy=2010; ey=2019; } else if (d === "20s") { sy=2020; ey=2029; }
            url += `&primary_release_date.gte=${sy}-01-01&primary_release_date.lte=${ey}-12-31`;
        }

        const stopWords = ["i", "want", "a", "an", "the", "movie", "film", "show", "me", "about", "like", "with", "from", "in", "and", "or", "some"];
        let words = query.split(" ").filter(w => !stopWords.includes(w) && !Object.keys(genreMap).includes(w) && !w.match(/\d+/));
        if (words.length > 0) {
            const keywordStr = words.join(" ");
            const kwRes = await fetch(`https://api.themoviedb.org/3/search/keyword?api_key=${API_KEY}&query=${encodeURIComponent(keywordStr)}`);
            const kwData = await kwRes.json();
            if (kwData.results.length > 0) url += `&with_keywords=${kwData.results[0].id}`;
        }

        if (selectedGenres.length === 0 && !yearMatch && !decadeMatch && words.length === 0) url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
        const finalRes = await fetch(url);
        const finalData = await finalRes.json();
        displayMovies(finalData.results);
    } catch (error) { document.getElementById("movies").innerHTML = "<h2 style='text-align:center; color:var(--netflix-red); width: 100%;'>AI Core Malfunction. Try again.</h2>"; }
}

// --- 5. 📌 PERSONAL WATCHLIST ---
function toggleWatchlist(id, title, posterPath, voteAverage) {
    if(!currentUser) return openAuthModal(); // Require Login!
    const exists = myWatchlist.find(m => m.id === id);
    if (exists) {
        myWatchlist = myWatchlist.filter(m => m.id !== id);
        alert(`${title} removed from Watchlist!`);
    } else {
        myWatchlist.push({ id, title, poster_path: posterPath, vote_average: voteAverage });
        alert(`${title} added to Watchlist!`);
    }
    localStorage.setItem('cinevault_watchlist', JSON.stringify(myWatchlist));
    viewMovieDetails(id); 
}

function showWatchlist() {
    closeDetails();
    isViewingFilteredGrid = true;
    lastOpenedMovieId = null;
    document.getElementById("ai-container").style.display = "none"; 
    document.querySelector("h1").innerText = `📌 ${currentUser}'s Watchlist`;
    displayMovies(myWatchlist);
}

// --- 6. STANDARD SEARCH & FILTERS ---
async function searchMovies() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) return;
    closeDetails(); 
    isViewingFilteredGrid = true; lastOpenedMovieId = null; 
    document.querySelector("h1").innerText = `🎬 Search Results: "${query}"`;
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    displayMovies(data.results);
}
function handleSearch(event) { if (event.key === "Enter") searchMovies(); }
async function fetchMoviesByActor(actorId, actorName) {
    lastOpenedMovieId = currentActiveMovieId; isViewingFilteredGrid = true; closeDetails();
    document.querySelector("h1").innerText = `🎬 Movies Starring: ${actorName}`;
    const res = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_cast=${actorId}&sort_by=popularity.desc`);
    const data = await res.json(); displayMovies(data.results);
}
async function fetchMoviesByGenre(genreId, genreName) {
    lastOpenedMovieId = currentActiveMovieId; isViewingFilteredGrid = true; closeDetails();
    document.querySelector("h1").innerText = `🎬 Top ${genreName} Movies`;
    const res = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc`);
    const data = await res.json(); displayMovies(data.results);
}

// --- 7. MOVIE DETAILS (WITH SMART THEATER LOGIC) ---
function isMovieInTheaters(releaseDateString) {
    if (!releaseDateString) return false;
    const releaseDate = new Date(releaseDateString);
    const today = new Date(); 
    const diffTime = today - releaseDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= -14 && diffDays <= 60;
}

async function viewMovieDetails(movieId) {
    currentActiveMovieId = movieId;
    document.getElementById("movies").style.display = "none";
    document.getElementById("movie-details").style.display = "block";
    document.getElementById("search-container").style.display = "none"; 
    document.getElementById("ai-container").style.display = "none"; 
    document.getElementById("booking-page").style.display = "none"; 
    const detailsContent = document.getElementById("details-content");
    detailsContent.innerHTML = "<h2 style='text-align: center; padding: 50px;'>Loading Cinematic Data...</h2>";

    try {
        const [detailsRes, creditsRes, reviewsRes, videosRes, providersRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}`),
            fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${API_KEY}`),
            fetch(`https://api.themoviedb.org/3/movie/${movieId}/reviews?api_key=${API_KEY}`),
            fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${API_KEY}`),
            fetch(`https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${API_KEY}`)
        ]);
        const movie = await detailsRes.json(); const credits = await creditsRes.json(); const reviewsData = await reviewsRes.json(); const videosData = await videosRes.json(); const providersData = await providersRes.json();

        const inTheaters = isMovieInTheaters(movie.release_date);
        let bookingButtonHTML = inTheaters ? `<button class="book-btn" onclick="openBookingPage(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">🎟️ Book Seat</button>` : `<div class="not-in-theaters-btn">Not currently in theaters</div>`;
        const isInWatchlist = myWatchlist.some(m => m.id === movie.id);
        const watchBtnText = isInWatchlist ? "❌ Remove from Watchlist" : "📌 Add to Watchlist";
        const trailer = videosData.results.find(vid => vid.site === "YouTube" && vid.type === "Trailer");
        const trailerBtnHTML = trailer ? `<a href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" class="book-btn" style="display: block; text-align: center; text-decoration: none; background: #E50914; color: white; margin-top: 10px;">▶ Watch Trailer</a>` : "";
        const regionData = providersData.results?.IN || providersData.results?.US;
        let watchHTML = "";
        if (regionData && regionData.flatrate) {
            const watchLink = regionData.link; 
            const platforms = regionData.flatrate.map(p => `<a href="${watchLink}" target="_blank" title="Watch on ${p.provider_name}" style="display: inline-block; transition: transform 0.2s ease; margin-right: 15px; margin-bottom: 10px;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"><img src="https://image.tmdb.org/t/p/original${p.logo_path}" style="width: 45px; height: 45px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);"></a>`).join("");
            watchHTML = `<div class="lb-tabs" style="margin-top: 25px;"><span>AVAILABLE</span> TO STREAM</div><div style="display: flex; flex-wrap: wrap; margin-top: 15px;">${platforms}</div>`;
        }
        const director = credits.crew.find(person => person.job === "Director")?.name || "Unknown";
        const year = movie.release_date ? movie.release_date.substring(0, 4) : "";
        const castPills = credits.cast.slice(0, 15).map(actor => `<span class="pill" onclick="fetchMoviesByActor(${actor.id}, '${actor.name.replace(/'/g, "\\'")}')">${actor.name}</span>`).join("");
        const genrePills = movie.genres && movie.genres.length > 0 ? movie.genres.map(g => `<span class="pill" onclick="fetchMoviesByGenre(${g.id}, '${g.name}')">${g.name}</span>`).join("") : "";
        const taglineHTML = movie.tagline ? `<p style="font-size: 1.1rem; color: #fff; text-transform: uppercase; letter-spacing: 1px;"><em>${movie.tagline}</em></p>` : "";
        let communityReviewsHTML = "";
        if (reviewsData.results && reviewsData.results.length > 0) {
            reviewsData.results.slice(0, 3).forEach(rev => { const shortText = rev.content.length > 250 ? rev.content.substring(0, 250) + "..." : rev.content; communityReviewsHTML += `<div class="review-card"><h4>👤 ${rev.author}</h4><p>"${shortText}"</p></div>`; });
        } else { communityReviewsHTML = "<p>No community reviews yet.</p>"; }

        detailsContent.innerHTML = `
            <div class="hero-banner" style="background-image: url('https://image.tmdb.org/t/p/original${movie.backdrop_path}');"></div>
            <div class="lb-container">
                <div class="lb-left">
                    <img src="${IMG_PATH + movie.poster_path}" class="lb-poster" alt="${movie.title}">
                    <div class="action-grid">${bookingButtonHTML}<button class="watchlist-add-btn" onclick="toggleWatchlist(${movie.id}, '${movie.title.replace(/'/g, "\\'")}', '${movie.poster_path}', ${movie.vote_average})">${watchBtnText}</button></div>
                    ${trailerBtnHTML}
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <a href="https://www.themoviedb.org/movie/${movie.id}" target="_blank" class="pill" style="flex: 1; text-align: center; text-decoration: none; background: #01b4e4; color: black; font-weight: bold;">TMDB</a>
                        <a href="https://www.imdb.com/title/${movie.imdb_id}" target="_blank" class="pill" style="flex: 1; text-align: center; text-decoration: none; background: #f5c518; color: black; font-weight: bold;">IMDb</a>
                    </div>
                </div>
                <div class="lb-right">
                    <div class="lb-header"><h2>${movie.title} <span class="lb-year">${year}</span></h2><p class="lb-director">Directed by <strong>${director}</strong></p></div>
                    ${taglineHTML}
                    <p class="lb-overview">${movie.overview}</p>
                    ${watchHTML}
                    <div class="lb-tabs"><span>CAST</span> & GENRES</div>
                    <div class="pill-container">${genrePills}</div><div class="pill-container">${castPills}</div>
                    <div class="lb-tabs"><span>COMMUNITY</span> REVIEWS</div>${communityReviewsHTML}
                </div>
            </div>`;
    } catch (error) { detailsContent.innerHTML = "<h2 style='text-align: center;'>Error loading movie details.</h2>"; }
}

// --- 8. 🎟️ FULL-PAGE SEAT BOOKING SYSTEM (WITH RUPEES) ---
let selectedSeatsArray = []; let currentSelectedTime = "07:30 PM";
const seatTiers = [ { name: "RECLINERS - ₹250", price: 250, rows: ['A', 'B'], seatsPerRow: 10 }, { name: "EXECUTIVE - ₹150", price: 150, rows: ['C', 'D', 'E', 'F'], seatsPerRow: 12 }, { name: "NORMAL - ₹100", price: 100, rows: ['G', 'H'], seatsPerRow: 14 } ];

function openBookingPage(id, title) {
    if(!currentUser) return openAuthModal(); // Require Login to open Booking!
    
    document.getElementById("movie-details").style.display = "none";
    document.getElementById("booking-page").style.display = "flex";
    document.getElementById("seat-movie-title").innerText = title;
    currentSelectedTime = "07:30 PM"; document.getElementById("header-time-display").innerText = `Today, ${currentSelectedTime}`; document.getElementById("receipt-time").innerText = currentSelectedTime;
    document.querySelectorAll(".time-pill").forEach(p => { p.classList.remove("selected"); if (p.innerText === "07:30 PM") p.classList.add("selected"); });
    generateSeats();
}
function selectTime(time, elementBtn) { document.querySelectorAll(".time-pill").forEach(p => p.classList.remove("selected")); elementBtn.classList.add("selected"); currentSelectedTime = time; document.getElementById("header-time-display").innerText = `Today, ${time}`; document.getElementById("receipt-time").innerText = time; generateSeats(); }
function generateSeats() {
    const seatGrid = document.getElementById("seat-grid"); seatGrid.innerHTML = ""; selectedSeatsArray = []; updateCheckout();
    seatTiers.forEach(tier => {
        const tierLabel = document.createElement("div"); tierLabel.classList.add("tier-label"); tierLabel.innerText = tier.name; seatGrid.appendChild(tierLabel);
        tier.rows.forEach(rowLetter => {
            const rowDiv = document.createElement("div"); rowDiv.classList.add("seat-row"); rowDiv.innerHTML = `<div class="row-label">${rowLetter}</div>`;
            for (let i = 1; i <= tier.seatsPerRow; i++) {
                if (tier.seatsPerRow === 10 && (i === 3 || i === 9)) rowDiv.innerHTML += `<div class="aisle"></div>`; if (tier.seatsPerRow === 12 && (i === 4 || i === 10)) rowDiv.innerHTML += `<div class="aisle"></div>`; if (tier.seatsPerRow === 14 && (i === 5 || i === 11)) rowDiv.innerHTML += `<div class="aisle"></div>`;
                const seat = document.createElement("div"); seat.classList.add("seat"); seat.title = `${rowLetter}${i} - ₹${tier.price}`; 
                if (Math.random() < 0.25) { seat.classList.add("occupied"); } else { seat.classList.add("available"); seat.addEventListener("click", () => toggleSeat(seat, `${rowLetter}${i}`, tier.price)); }
                rowDiv.appendChild(seat);
            }
            rowDiv.innerHTML += `<div class="row-label">${rowLetter}</div>`; seatGrid.appendChild(rowDiv);
        });
    });
}
function closeBookingPage() { document.getElementById("booking-page").style.display = "none"; document.getElementById("movie-details").style.display = "block"; }
function toggleSeat(seatElement, seatId, seatPrice) {
    const seatIndex = selectedSeatsArray.findIndex(s => s.id === seatId);
    if (seatIndex > -1) { seatElement.classList.remove("selected"); selectedSeatsArray.splice(seatIndex, 1); } 
    else { if (selectedSeatsArray.length >= 10) return alert("Max 10 seats allowed!"); seatElement.classList.add("selected"); selectedSeatsArray.push({ id: seatId, price: seatPrice }); }
    updateCheckout();
}
function updateCheckout() {
    const ticketCount = selectedSeatsArray.length; const subtotal = selectedSeatsArray.reduce((sum, seat) => sum + seat.price, 0); const convenienceFee = ticketCount * 30; const grandTotal = subtotal + convenienceFee;
    document.getElementById("seat-count").innerText = ticketCount; document.getElementById("ticket-subtotal").innerText = subtotal.toFixed(2); document.getElementById("convenience-fee").innerText = convenienceFee.toFixed(2); document.getElementById("seat-total").innerText = grandTotal.toFixed(2);
    const payBtn = document.querySelector(".pay-btn");
    if (ticketCount > 0) { payBtn.innerText = `Pay ₹${grandTotal.toFixed(2)}`; payBtn.classList.add("active"); } else { payBtn.innerText = "Select Seats to Pay"; payBtn.classList.remove("active"); }
}

function confirmBooking() {
    if (selectedSeatsArray.length === 0) return alert("Select at least one seat.");
    const seatNames = selectedSeatsArray.map(s => s.id).join(", ");
    
    // SEND USERNAME WITH BOOKING
    fetch("/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            username: currentUser, 
            movieId: currentActiveMovieId, 
            seats: seatNames,
            showTime: currentSelectedTime,
            totalPaid: document.getElementById("seat-total").innerText
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(`🎟️ BOOKING CONFIRMED!\n\nUser: ${currentUser}\nMovie: ${document.getElementById("seat-movie-title").innerText}\nTime: ${currentSelectedTime}\nSeats: ${seatNames}\nTotal Paid: ₹${document.getElementById("seat-total").innerText}`);
        closeBookingPage();
    }); 
}

// --- 9. ADVANCED REVIEWS & EXPORTER ---
function toggleAdvancedReview() { document.getElementById("advanced-fields").style.display = document.getElementById("advancedReviewToggle").checked ? "block" : "none"; }
function addReview() {
    if (!currentUser) return openAuthModal(); // Require Login to Review!
    if (!currentActiveMovieId) return alert("Error: No movie selected!");
    
    fetch("/review", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            username: currentUser, 
            movieId: currentActiveMovieId, 
            review: document.getElementById("reviewText").value,
            rating: document.getElementById("rating").value,
            characterArcs: document.getElementById("characterText").value,
            cinematography: document.getElementById("cinematographyText").value
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        document.getElementById("reviewText").value = ""; document.getElementById("rating").value = ""; document.getElementById("characterText").value = ""; document.getElementById("cinematographyText").value = "";
    });
}
function exportScript() {
    const headerEl = document.querySelector(".lb-header h2");
    if (!headerEl) return alert("Movie details not fully loaded yet.");
    const movieTitle = headerEl.childNodes[0].nodeValue.trim(); const hook = document.getElementById("reviewText").value;
    if(!hook) return alert("Please write a general review or hook before exporting!");
    const scriptContent = `==================================================\n🎬 SHORT FORM SCRIPT: ${movieTitle.toUpperCase()}\n==================================================\n[VISUAL]                               | [AUDIO / VOICEOVER]\n---------------------------------------|-----------------------------------------\nDynamic hook shot from the film.       | "Here is why ${movieTitle} is absolute cinema..."\nOn-screen text reading: "Must Watch"   | "${hook}"\nPoint to the camera/screen.            | "What did you think of the pacing? Let me know below."\n==================================================`.trim();
    const blob = new Blob([scriptContent], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${movieTitle.replace(/\s+/g, '_')}_Script.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}