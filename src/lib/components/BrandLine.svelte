<script lang="ts">
  let currentYear: number = new Date().getFullYear();
</script>
<div class="col-span-full flex w-full flex-col items-center justify-center gap-x-2 border-t border-base-content/10 py-3 text-center text-sm text-base-content/70 sm:flex-row">
		<p>&copy; {currentYear} Delion AI Labs. All rights reserved.</p>

		<div>
			Powered by --  
			<a
				href="https://ailaboratory.site/"
				target="_blank"
				rel="noopener noreferrer"
				class="link link-hover font-medium text-primary"
			>
				 ailaboratory.site
			</a>
	   </div>
  </div>