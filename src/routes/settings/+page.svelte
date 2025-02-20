<script lang="ts">
	import { Info, Trash2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	
	let settings;
	onMount(async () => {
		let settingsResponse = await depwnerPreferences.get();
		settings = JSON.parse(settingsResponse);
	});
	$effect(() => {
		depwnerPreferences.set(JSON.stringify(settings));
	});
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
		</div>
	</div>
</div>

<style>
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
