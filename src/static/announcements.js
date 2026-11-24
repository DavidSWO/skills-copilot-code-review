document.addEventListener("DOMContentLoaded", () => {
  const banner = document.getElementById("announcements");
  const dialog = document.getElementById("announcement-dialog");
  const manageButton = document.getElementById("manage-announcements");
  const list = document.getElementById("announcement-list");
  const form = document.getElementById("announcement-form");
  const feedback = document.getElementById("announcement-feedback");
  const idInput = document.getElementById("announcement-id");
  const titleInput = document.getElementById("announcement-title");
  const messageInput = document.getElementById("announcement-message");
  const startInput = document.getElementById("announcement-start");
  const expirationInput = document.getElementById("announcement-expiration");
  const formTitle = document.getElementById("announcement-form-title");
  const saveButton = document.getElementById("save-announcement");
  let busy = false;
  let signedIn = false;
  let announcements = [];
  let publicRequest = 0;
  let managementRequest = 0;

  document.getElementById("announcement-timezone").textContent =
    `Dates use your local time (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function notify(message, type = "error") {
    feedback.textContent = message;
    feedback.className = `message ${type}`;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      if (response.status === 401) {
        signedIn = false;
        manageButton.classList.add("hidden");
        dialog.close();
        document.dispatchEvent(new CustomEvent("session-expired"));
      }
      if (response.status === 422) {
        throw new Error("Check your message and dates. Expiration must be after the start date.");
      }
      throw new Error(response.status === 401
        ? "Your session has expired. Please sign in again."
        : "Unable to update the noticeboard. Please try again.");
    }
    return response.status === 204 ? null : response.json();
  }

  function status(announcement) {
    const now = Date.now();
    if (new Date(announcement.expires_at).getTime() <= now) return "Expired";
    if (announcement.starts_at && new Date(announcement.starts_at).getTime() > now) return "Scheduled";
    return "Active";
  }

  async function loadPublic() {
    const version = ++publicRequest;
    try {
      const data = await request("/announcements");
      if (version !== publicRequest) return;
      banner.replaceChildren();
      data.forEach((item) => {
        const card = element("article", "announcement-banner");
        card.append(element("p", "eyebrow", "SCHOOL ANNOUNCEMENT"),
          element("h3", "", item.title), element("p", "announcement-copy", item.message));
        banner.append(card);
      });
      banner.classList.toggle("hidden", !banner.childElementCount);
    } catch (error) {
      console.error("Error loading announcements:", error);
      if (version !== publicRequest) return;
      banner.replaceChildren(element("p", "message error", "School announcements could not be loaded."));
      const retry = element("button", "quiet-button", "Try again");
      retry.addEventListener("click", loadPublic);
      banner.append(retry);
      banner.classList.remove("hidden");
    }
  }

  function resetForm() {
    form.reset();
    idInput.value = "";
    formTitle.textContent = "New announcement";
    saveButton.textContent = "Publish announcement";
    document.getElementById("cancel-announcement").textContent = "Clear";
    expirationInput.setCustomValidity("");
  }

  function localDate(value) {
    if (!value) return "";
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 19);
  }

  function edit(item) {
    idInput.value = item.id;
    titleInput.value = item.title;
    messageInput.value = item.message;
    startInput.value = localDate(item.starts_at);
    expirationInput.value = localDate(item.expires_at);
    expirationInput.setCustomValidity("");
    formTitle.textContent = "Edit announcement";
    saveButton.textContent = "Save changes";
    document.getElementById("cancel-announcement").textContent = "Cancel editing";
    titleInput.focus();
  }

  function renderList() {
    list.replaceChildren();
    if (!announcements.length) {
      list.append(element("div", "announcement-empty", "A fresh noticeboard. Create your first announcement to get started."));
      return;
    }
    announcements.forEach((item) => {
      const card = element("article", "announcement-card");
      const state = status(item);
      card.append(element("span", `announcement-status ${state.toLowerCase()}`, state),
        element("h4", "", item.title), element("p", "announcement-copy", item.message),
        element("p", "announcement-dates",
          `${item.starts_at ? `Starts ${new Date(item.starts_at).toLocaleString()}` : "Starts immediately"}\nExpires ${new Date(item.expires_at).toLocaleString()}`));
      const actions = element("div", "announcement-card-actions");
      const editButton = element("button", "quiet-button", "Edit");
      editButton.disabled = busy;
      editButton.setAttribute("aria-label", `Edit ${item.title}`);
      editButton.addEventListener("click", () => edit(item));
      const deleteButton = element("button", "danger-button", "Delete");
      deleteButton.disabled = busy;
      deleteButton.setAttribute("aria-label", `Delete ${item.title}`);
      deleteButton.addEventListener("click", () => {
        const confirmation = element("div", "announcement-delete-confirmation");
        confirmation.append(element("p", "", "Delete this announcement? This cannot be undone."));
        const cancel = element("button", "quiet-button", "Keep it");
        cancel.addEventListener("click", renderList);
        const confirm = element("button", "danger-button", "Yes, delete");
        confirm.addEventListener("click", () => mutate(
          `/announcements/${item.id}`, { method: "DELETE" }, "Announcement deleted.",
          idInput.value === item.id
        ));
        confirmation.append(cancel, confirm);
        actions.replaceWith(confirmation);
        cancel.focus();
      });
      actions.append(editButton, deleteButton);
      card.append(actions);
      list.append(card);
    });
  }

  async function loadManagement() {
    const version = ++managementRequest;
    list.replaceChildren(element("p", "announcement-empty", "Loading announcements..."));
    try {
      const data = await request("/announcements/manage");
      if (!signedIn || version !== managementRequest) return;
      announcements = data;
      renderList();
      return true;
    } catch (error) {
      console.error("Error loading announcement management:", error);
      if (version !== managementRequest) return;
      list.replaceChildren(element("p", "message error", "Unable to load announcements. Use Refresh to try again."));
      notify(error.message);
      return false;
    }
  }

  async function mutate(url, options, success, clear = true) {
    if (busy) return;
    busy = true;
    let renderAfter = true;
    form.querySelectorAll("input, textarea, button").forEach((input) => { input.disabled = true; });
    renderList();
    try {
      await request(url, options);
      if (clear) resetForm();
      notify(success, "success");
      const [loaded] = await Promise.all([loadManagement(), loadPublic()]);
      renderAfter = loaded;
    } catch (error) {
      console.error("Error saving announcement:", error);
      notify(error.message);
    } finally {
      busy = false;
      form.querySelectorAll("input, textarea, button").forEach((input) => { input.disabled = false; });
      if (renderAfter) renderList();
    }
  }

  function validateDates() {
    expirationInput.setCustomValidity(startInput.value && expirationInput.value &&
      new Date(startInput.value) >= new Date(expirationInput.value)
      ? "Expiration must be after the start date." : "");
  }
  startInput.addEventListener("input", validateDates);
  expirationInput.addEventListener("input", validateDates);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    validateDates();
    if (!form.reportValidity()) return;
    if (!titleInput.value.trim() || !messageInput.value.trim()) {
      notify("Please enter a title and message, not just spaces.");
      return;
    }
    const id = idInput.value;
    mutate(id ? `/announcements/${id}` : "/announcements", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleInput.value.trim(), message: messageInput.value.trim(),
        starts_at: startInput.value ? new Date(startInput.value).toISOString() : null,
        expires_at: new Date(expirationInput.value).toISOString(),
      }),
    }, id ? "Changes saved." : "Announcement created.");
  });
  manageButton.addEventListener("click", () => {
    if (!signedIn) return;
    feedback.classList.add("hidden");
    resetForm();
    dialog.showModal();
    loadManagement();
  });
  document.getElementById("close-announcements").addEventListener("click", () => dialog.close());
  document.getElementById("cancel-announcement").addEventListener("click", resetForm);
  document.getElementById("refresh-announcements").addEventListener("click", loadManagement);
  document.addEventListener("auth-changed", (event) => {
    signedIn = event.detail;
    if (!signedIn) {
      managementRequest++;
      dialog.close();
      announcements = [];
      list.replaceChildren();
      resetForm();
    }
  });
  loadPublic();
  setInterval(() => {
    loadPublic();
  }, 30000);
});
