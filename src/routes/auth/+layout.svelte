<script>
  // This layout is used for all authentication pages
</script>

<div class="min-h-screen flex flex-col">
  <main class="flex-grow">
    <slot />
  </main>
  
  <footer class="footer footer-center p-4 bg-base-300 text-base-content">
    <div>
      <p>© {new Date().getFullYear()} Round Robin - Sharing letters, one typo at a time</p>
    </div>
  </footer>
</div>