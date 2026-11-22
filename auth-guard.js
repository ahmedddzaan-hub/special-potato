
import { auth } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const RETURN_KEY = "toolboxhub_return_to";

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.documentElement.classList.add("toolbox-auth-ready");
    return;
  }

  // Save the requested tool.
  const returnPath =
    window.location.pathname +
    window.location.search +
    window.location.hash;

  sessionStorage.setItem(RETURN_KEY, returnPath);

  // Redirect to the homepage.
  window.location.replace("../index.html?auth=required");
});
