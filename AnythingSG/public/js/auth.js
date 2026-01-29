(() => {
  const USERS_KEY = "as_users";
  const SESSION_KEY = "as_session";

  const normalizeEmail = (email) => (email || "").trim().toLowerCase();
  const normalizeWallet = (wallet) => (wallet || "").trim().toLowerCase();

  const loadUsers = () => {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const saveUsers = (users) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const loadSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const saveSession = (session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
  };

  const truncateWallet = (wallet) => {
    if (!wallet) return "";
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const applyAuthUI = () => {
    const session = loadSession();
    document.querySelectorAll('[data-auth="guest"]').forEach((el) => {
      el.hidden = Boolean(session);
    });
    document.querySelectorAll('[data-auth="user"]').forEach((el) => {
      el.hidden = !session;
    });
    document.querySelectorAll('[data-role="buyer"]').forEach((el) => {
      el.hidden = !session || session.role !== "buyer";
    });
    document.querySelectorAll('[data-role="seller"]').forEach((el) => {
      el.hidden = !session || session.role !== "seller";
    });

    const navUserLabel = document.getElementById("navUserLabel");
    if (navUserLabel) {
      if (session) {
        const roleLabel = session.role ? session.role[0].toUpperCase() + session.role.slice(1) : "User";
        navUserLabel.textContent = `${roleLabel} • ${truncateWallet(session.wallet)}`;
        navUserLabel.hidden = false;
      } else {
        navUserLabel.hidden = true;
      }
    }

    const registerSellerLink = document.getElementById("registerSellerLink");
    if (registerSellerLink && session && session.role === "buyer") {
      const email = encodeURIComponent(session.email || "");
      registerSellerLink.href = `/auth/register?role=seller&email=${email}`;
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        clearSession();
        window.location.href = "/shop";
      });
    }
  };

  const showLoginReminder = (targetEl, message) => {
    if (targetEl) {
      targetEl.textContent = message;
      targetEl.hidden = false;
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      alert(message);
    }
  };

  const guardRequiresLogin = (selector, targetEl) => {
    const elements = document.querySelectorAll(selector);
    if (!elements.length) return;
    elements.forEach((el) => {
      el.addEventListener("click", (event) => {
        if (loadSession()) return;
        event.preventDefault();
        showLoginReminder(targetEl, "Remember to log in before continuing.");
      });
    });
  };

  window.AnythingSGAuth = {
    normalizeEmail,
    normalizeWallet,
    loadUsers,
    saveUsers,
    loadSession,
    saveSession,
    clearSession,
    guardRequiresLogin
  };

  document.addEventListener("DOMContentLoaded", applyAuthUI);
})();
