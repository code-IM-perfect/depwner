<script lang="ts">
	import { Info, Trash2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	
	let settings = $state({
		yara: true,
		schedule: {
			active: true,
			freq: 'weekly',
			days: {
				sun: true,
				mon: false,
				tue: false,
				wed: false,
				thu: false,
				fri: false,
				sat: false
			},
			time: '13:00'
		},
		locations: [],
		lastUpdated: 'Never'
	});

	let isLoadingUpdate = $state(false);
	let updateProgressCurrent = $state(0);
	let updateProgressTotal = $state(0);
	let showProgressBar = $state(false);
	
	onMount(async () => {
		// Fetch initial settings
		try {
			let settingsResponse = await depwnerPreferences.get();
			settings = JSON.parse(settingsResponse);
		} catch (e) {
			console.error("Failed to load settings:", e);
		}

		// Setup update progress listener
		depwnerPreferences.onUpdateProgress((progress) => {
			console.log('Received updateProgress event:', progress);
			updateProgressCurrent = progress.processed;
			updateProgressTotal = progress.total;
			showProgressBar = true;

			if (progress.completed || progress.error) {
				if (!progress.error) {
					// Update completed successfully
					setTimeout(() => {
						showProgressBar = false;
					}, 1000);
				}
			}
		});
	});
	
	// Save settings on changes
	$effect(() => {
		console.log('Saving settings:', settings);
		depwnerPreferences.set(JSON.stringify(settings));
	});

	async function handleUpdateDefinitionsClick() {
		console.log('Update Definitions button clicked');
		isLoadingUpdate = true;
		showProgressBar = true; // Show progress bar when update starts
		updateProgressCurrent = 0; // Reset progress
		updateProgressTotal = 0;   // Reset progress
		try {
			const result = await electronAPI.updateDefinitions();
			alert(result.message || 'Update process initiated.');
			if (result.success && result.lastUpdated) {
				settings.lastUpdated = result.lastUpdated;
			}
		} catch (error) {
			console.error('Error calling updateDefinitions:', error);
			alert('Failed to start update process: ' + (error.message || 'Unknown error'));
		} finally {
			isLoadingUpdate = false;
			if (!showProgressBar) {
				// Only reset if no active progress is shown
				updateProgressCurrent = 0;
				updateProgressTotal = 0;
			}
		}
	}
</script>

<div class="mainCont">
	<!-- <h1>dePWNer Settings</h1> -->
	<div class="m-[5vw]">
		<!-- <p>You can set your preferences here.</p> -->
		<div class="grid justify-center">
			<div class="headingInfo">
				<h2>Advanced Detection</h2>
				<button class="tooltip">
					<span class="tooltiptext"
						>Enable Advanced Detection to scan for malware files on an extended dataset. Recommended
						only on systems with 4GB RAM or more and at least a Dual Core CPU</span
					>
					<Info />
				</button>
			</div>
			{#if !settings.yara}
				<p class="text-catp-red">Only disable if facing performance issues</p>
			{:else}
				<p>Enabling may hinder performance on outdated systems</p>
			{/if}
			<div class="settingsField">
				<h3>Enable</h3>
				<div class="toggleButton">
					<input type="checkbox" id="checkboxInput" bind:checked={settings.yara} />
					<label
						for="checkboxInput"
						class="toggleSwitch relative flex cursor-pointer items-center justify-center bg-catp-crust"
					>
					</label>
				</div>
			</div>
			<div class="headingInfo">
				<h2>Scheduled Scans</h2>
				<button class="tooltip">
					<span class="tooltiptext">
						It is recommended to schedule full system scans for an extra layer of protection. They
						can be scheduled at non-working hours like the Lunch Break to not affect performance.
					</span>
					<Info />
				</button>
			</div>
			{#if !settings.schedule.active}
				<p class="text-catp-red">disabling this is not recommended!</p>
			{/if}
			<div class="settingsField">
				<h3>Enable</h3>
				<div class="toggleButton">
					<input type="checkbox" id="checkboxInputSch" bind:checked={settings.schedule.active} />
					<label
						for="checkboxInputSch"
						class="toggleSwitch relative flex cursor-pointer items-center justify-center bg-catp-crust"
					>
					</label>
				</div>
			</div>
			<div class="headingInfo">
				<h2>Locations</h2>
				<button class="tooltip">
					<span class="tooltiptext">
						Specify the locations that depwner should monitor. You can even fully select all of your
						partitions to monitor all of your system, but that may affect performance on outdated
						systems.
					</span>
					<Info />
				</button>
			</div>
			<div class="locationSettings">
				<div class="addButton">
					<!-- <input type="text" name="location" id="locationInput" /> -->
					<!-- <button class="addPath">+</button> -->
					<button
						onclick={async () => {
							let folder = await electronFilesystem.getFolder();
							console.log(folder);
							if (folder != 'user cancelled' && !settings.locations.includes(folder)) {
								settings.locations.push(folder);
							}
						}}>Add Path to Monitored Locations</button
					>
				</div>
				{#each settings.locations as location, i}
					<div class="entry">
						<div>{location}</div>
						<button
							onclick={() => {
								settings.locations.splice(i, 1);
							}}
						>
							<Trash2 />
						</button>
					</div>
				{/each}
				{#if !settings.locations[0]}
					<p class="text-catp-red">Please add at least one location to monitor</p>
				{/if}
			</div>
			<div class="headingInfo">
				<h2>Update Definitions</h2>
				<button class="tooltip">
					<span class="tooltiptext">
						Keep your malware definitions up to date to ensure the best protection against new
						threats.
					</span>
					<Info />
				</button>
			</div>
			<div class="settingsField">
				<button class="updateButton" onclick={handleUpdateDefinitionsClick} disabled={isLoadingUpdate}>
					{#if isLoadingUpdate}
						Updating...
					{:else}
						Update Now
					{/if}
				</button>
			</div>
			<div class="lastUpdatedText">
				<p>Last updated: {settings.lastUpdated || 'Never'}</p>
			</div>
			{#if showProgressBar && isLoadingUpdate}
				<div class="progress-bar-container">
					<progress value={updateProgressCurrent} max={updateProgressTotal}></progress>
					{#if updateProgressTotal > 0}
						<span>{updateProgressCurrent} / {updateProgressTotal}</span>
					{:else}
						<span>Processing...</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.progress-bar-container {
		width: 80%;
		margin: 10px auto;
		text-align: center;
		color: rgb(var(--ctp-text));
	}
	.progress-bar-container span {
		display: block;
		margin-top: 5px;
		font-size: 0.9em;
	}
	progress {
		width: 100%;
		height: 20px;
		border-radius: 5px; /* Consistent with other elements */
		border: 1px solid rgb(var(--ctp-overlay0)); /* Subtle border */
	}
	/* Track color (background of the progress bar) */
	progress::-webkit-progress-bar {
		background-color: rgb(var(--ctp-surface0)); /* Catppuccin Surface0 */
		border-radius: 5px;
	}
	progress::-moz-progress-bar { /* Firefox */
		background-color: rgb(var(--ctp-surface0));
		border-radius: 5px;
	}
	/* Bar color (the actual progress) */
	progress::-webkit-progress-value {
		background-color: rgb(var(--ctp-blue)); /* Catppuccin Blue */
		border-radius: 5px;
		transition: width 0.2s ease-in-out;
	}
	progress[value]::-moz-progress-bar { /* Firefox */
		background-color: rgb(var(--ctp-blue));
		border-radius: 5px;
		transition: width 0.2s ease-in-out;
	}

	button.tooltip {
		position: relative;
	}
	.tooltip .tooltiptext {
		visibility: hidden;
		max-width: 30vw;
		width: max-content;
		background-color: rgb(var(--ctp-crust));
		/* color: #fff; */
		text-align: center;
		padding: 0.5vh 1.5vw;
		border-radius: 0.7vh;

		/* Position the tooltip text - see examples below! */
		position: absolute;
		z-index: 1;
		/* left: 0; */
		/* right: 0; */
		bottom: -10%;
		translate: -50% 100%;
	}

	/* Show the tooltip text when you mouse over the tooltip container */
	.tooltip:hover .tooltiptext {
		visibility: visible;
	}
	.locationSettings {
		display: grid;
		place-items: center;
		gap: 0.5vw;
		margin-bottom: min(3vh, 3vw);
		max-height: min(38vh);
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		div {
			display: flex;
			align-content: center;
			justify-content: center;
			gap: 0.5vw;
			margin: 0.5vh 0;
		}
		.addButton {
			width: min(60vh, 50vw);
		}
		.entry {
			width: min(75vh, 60vw);
			div {
				margin: 0;
				border-radius: 1vh;
				background: rgb(var(--ctp-crust));
				padding: min(1vh, 1vw) min(1vw);
				font-size: min(2vh, 1.9vw);
				width: stretch;
			}
			button {
				width: max-content;
				color: rgb(var(--ctp-red));
				background: rgb(var(--ctp-crust));
			}
			button:hover {
				color: rgb(var(--ctp-crust));
				background: rgb(var(--ctp-red));
			}
		}
	}
	.locationSettings button {
		background: rgb(var(--ctp-mantle));
		color: rgb(var(--ctp-blue));
		border-radius: 1vh;
		padding: min(1vh, 1vw) min(1vw);
		font-size: min(2vh, 1.9vw);
		font-weight: 500;
		/* border: 0.2vh solid rgb(var(--ctp-crust)); */
		width: stretch;
		transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
	}
	.locationSettings button:hover {
		background: rgb(var(--ctp-blue));
		color: rgb(var(--ctp-mantle));
	}
	.updateButton {
		background: rgb(var(--ctp-mauve)); /* Using a different color for distinction */
		color: rgb(var(--ctp-base));
		border-radius: 1vh;
		padding: min(1vh, 1vw) min(1.5vw); /* Adjusted padding */
		font-size: min(2vh, 1.9vw);
		font-weight: 600; /* Slightly bolder */
		width: auto; /* Auto width based on content */
		transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
		margin: 0.5vh auto; /* Centering the button */
		display: block;
	}
	.updateButton:hover {
		background: rgb(var(--ctp-pink));
		color: rgb(var(--ctp-base));
		transform: translateY(-2px); /* Subtle hover effect */
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* Adding shadow for depth */
	}
	.lastUpdatedText {
		font-size: min(1.8vh, 1.5vw);
		color: rgb(var(--ctp-subtext0));
		margin-top: min(1vh, 0.5vw);
		margin-bottom: min(3vh, 3vw);
	}
	.headingInfo {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1vw;
		:global(svg) {
			margin-top: min(0.5vh, 0.6vw);
			--size: min(3vh, 3vw);
			height: var(--size);
			width: var(--size);
			stroke: rgb(var(--ctp-overlay1));
			transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
		}
		:global(svg):hover {
			/* stroke: rgb(var(--ctp-text)); */
			stroke: white;
			opacity: 0.95;
		}
	}
	.settingsField {
		display: flex;
		align-content: center;
		justify-content: center;
		/* max-width: 80vh; */
		/* width: 60vw; */
		gap: 1vw;
		margin-bottom: min(3vh, 3vw);
	}
	h3 {
		font-size: min(3vh, 2.5vw);
	}
	h2 {
		font-size: min(3vh, 3vw);
		font-weight: 800;
	}
	/* h1 { */
	/* 	position: absolute; */
	/* 	font-size: min(6vh, 5vw); */
	/* 	font-weight: 200; */
	/* 	top: 0; */
	/* 	right: 0; */
	/* 	left: 0; */
	/* 	margin: 4vh auto; */
	/* } */
	.toggleButton {
		--toggleWidth: min(7vh, 7vw);
		--toggleHeight: min(3.5vh, 3.5vw);
		display: grid;
		place-items: center;
	}

	#checkboxInput {
		display: none;
	}
	.toggleSwitch {
		width: var(--toggleWidth);
		height: var(--toggleHeight);
		border-radius: 100vh;
		transition-duration: 0.2s;
	}

	.toggleSwitch::after {
		--toggleSizeFrac: 0.6;
		--toggleMarginFrac: 0.2;
		content: '';
		position: absolute;
		height: calc(var(--toggleSizeFrac) * var(--toggleHeight));
		width: calc(var(--toggleSizeFrac) * var(--toggleHeight));
		left: calc(var(--toggleMarginFrac) * var(--toggleHeight));
		background-color: transparent;
		border-radius: 100%;
		transition-duration: 0.2s;
		border: calc(0.15 * var(--toggleHeight)) solid white;
	}

	#checkboxInput:checked + .toggleSwitch::after {
		/* transform: translateX(100%); */
		left: calc(
			var(--toggleWidth) - (var(--toggleSizeFrac) + var(--toggleMarginFrac)) * var(--toggleHeight)
		);
		transition-duration: 0.2s;
		background-color: white;
	}
	/* Switch background change */
	#checkboxInput:checked + .toggleSwitch {
		background-color: rgb(var(--ctp-blue));
		transition-duration: 0.2s;
	}

	#checkboxInputSch {
		display: none;
	}
	#checkboxInputSch:checked + .toggleSwitch::after {
		/* transform: translateX(100%); */
		left: calc(
			var(--toggleWidth) - (var(--toggleSizeFrac) + var(--toggleMarginFrac)) * var(--toggleHeight)
		);
		transition-duration: 0.2s;
		background-color: white;
	}
	/* Switch background change */
	#checkboxInputSch:checked + .toggleSwitch {
		background-color: rgb(var(--ctp-blue));
		transition-duration: 0.2s;
	}

	.mainCont {
		background: rgb(var(--ctp-base));
		height: 85vh;
		width: stretch;
		margin: 0 5vw;
		max-width: 110vh;
		border-radius: 1.5vh;
		text-align: center;
		display: grid;
		align-items: center;
		position: relative;
	}
	input {
		color-scheme: dark;
	}
</style>
