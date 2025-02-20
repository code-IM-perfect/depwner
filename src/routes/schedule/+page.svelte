<script lang="ts">
	import { onMount } from 'svelte';

	onMount(async () => {
		let settingsResponse = await depwnerPreferences.get();
		settings = JSON.parse(settingsResponse);
	});
	// let temp = $derived.by(() => {
	// 	const yo = settings;
	// 	console.log(yo);
	// 	return yo;
	// });
	$effect(() => {
		depwnerPreferences.set(JSON.stringify(settings));
	});
	// $effect(() => {
	// 	console.log('setting changed');
	// 	yo = settings;
	// });
</script>

<div class="mainCont">
	<div class="m-[5vw]">
		<h1>Scan Schedule</h1>
		<p>
			Schedule an automatic full system scan to add an additional layer of security.<br />You can
			set it to non-banking hours to not hurt performance
		</p>
		<!-- <p> -->
		<!-- 	Although Depwner has active monitoring, which detects and isolates malicious files as they are -->
		<!-- 	added on the filesystem, it is recommended to set up scheduled full system scans. To add an -->
		<!-- 	additional layer of security. -->
		<!-- </p> -->
		<div class="my-[2vh] grid justify-center">
			<div class="settingsField">
				<h3>Enable</h3>
				<div class="toggleButton">
					<input type="checkbox" id="checkboxInput" bind:checked={settings.schedule.active} />
					<label
						for="checkboxInput"
						class="toggleSwitch relative flex cursor-pointer items-center justify-center bg-catp-crust"
					>
					</label>
				</div>
			</div>
			{#if settings.schedule.active}
				<div class="settingsField mt-[2vh]">
					<h3>Scan Frequency</h3>
					<select name="freq" id="freq" bind:value={settings.schedule.freq}>
						<option value="hourly">Hourly</option>
						<option value="daily">Daily</option>
						<option value="weekly">Weekly</option>
					</select>
				</div>
				{#if settings.schedule.freq == 'hourly'}
					<h3>
						Full system scan
						<span style="text-transform: capitalize;font-weight: 700;">every hour</span>
					</h3>
				{:else}
					{#if settings.schedule.freq == 'weekly'}
						<div class="settingsField">
							<div class="toggleDayButton">
								<input
									type="checkbox"
									id="checkboxSun"
									class="checkboxDay"
									bind:checked={settings.schedule.days.sun}
								/>
								<label
									for="checkboxSun"
									class="toggleDay relative flex cursor-pointer items-center justify-center bg-catp-crust"
								>
									Sun
								</label>
							</div>
							<div class="toggleDayButton">
								<input
									type="checkbox"
									id="checkboxMon"
									class="checkboxDay"
									bind:checked={settings.schedule.days.mon}
								/>
								<label
									for="checkboxMon"
									class="toggleDay relative flex cursor-pointer items-center justify-center bg-catp-crust"
								>
									Mon
								</label>
							</div>
							<div class="toggleDayButton">
								<input
									type="checkbox"
									id="checkboxTue"
									class="checkboxDay"
									bind:checked={settings.schedule.days.tue}
								/>
								<label
									for="checkboxTue"
									class="toggleDay relative flex cursor-pointer items-center justify-center bg-catp-crust"
								>
									Tue
								</label>
							</div>
							<div class="toggleDayButton">
								<input
									type="checkbox"
									id="checkboxWed"
									class="checkboxDay"
									bind:checked={settings.schedule.days.wed}
								/>
								<label
									for="checkboxWed"
									class="toggleDay relative flex cursor-pointer items-center justify-center bg-catp-crust"
								>
									Wed
								</label>
							</div>
							<div class="toggleDayButton">
								<input
									type="checkbox"
									id="checkboxThu"
									class="checkboxDay"
									bind:checked={settings.schedule.days.thu}
								/>
								<label
									for="checkboxThu"
									class="toggleDay relative flex cursor-pointer items-center justify-center bg-catp-crust"
								>
									Thu
								</label>
							</div>
							<div class="toggleDayButton">
								<input
									type="checkbox"
									id="checkboxFri"
									class="checkboxDay"
									bind:checked={settings.schedule.days.fri}
								/>
								<label
									for="checkboxFri"
									class="toggleDay relative flex cursor-pointer items-center justify-center bg-catp-crust"
								>
									Fri
								</label>
							</div>
							<div class="toggleDayButton">
								<input
									type="checkbox"
									id="checkboxSat"
									class="checkboxDay"
									bind:checked={settings.schedule.days.sat}
								/>
								<label
									for="checkboxSat"
									class="toggleDay relative flex cursor-pointer items-center justify-center bg-catp-crust"
								>
									Sat
								</label>
							</div>
						</div>
					{/if}
					<div class="settingsField">
						<!-- <h3>Time of scan</h3> -->
						<input id="scanTime" type="time" name="scanTime" bind:value={settings.schedule.time} />
					</div>
					{#if settings.schedule.freq == 'weekly' && Object.values(settings.schedule.days).includes(true)}
						<h3>
							Scan
							<span style="text-transform: capitalize;font-weight: 700;">Every Week</span>
							on
							{#each Object.keys(settings.schedule.days) as day}
								{#if settings.schedule.days[day]}
									<span style="text-transform: capitalize;font-weight: 700;">{day}&nbsp;</span>
								{/if}
							{/each}
							at
							<span style="text-transform: capitalize;font-weight: 700;"
								>{settings.schedule.time}</span
							>
						</h3>
					{:else if settings.schedule.freq == 'weekly'}
						<h3 class="text-catp-red">Please choose at least one day of the week to scan</h3>
					{:else}
						<h3>
							Scan
							<span style="text-transform: capitalize;font-weight: 700;">Every Day</span>
							at
							<span style="text-transform: capitalize;font-weight: 700;"
								>{settings.schedule.time}</span
							>
						</h3>
					{/if}
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	#scanTime {
		background: rgb(var(--ctp-crust));
		border-radius: 1vh;
		padding: 0 min(1vw);
		/* text-align: center; */
		font-size: min(2vh, 1.9vw);
		font-weight: 500;
		border: 0.2vh solid rgb(var(--ctp-crust));
	}
	#scanTime:focus {
		border: 0.2vh solid rgb(var(--ctp-text));
		display: block;
	}
	select {
		background: rgb(var(--ctp-crust));
		border-radius: 1vh;
		padding: 0 min(1vw);
		/* text-align: center; */
		font-size: min(2vh, 1.9vw);
		font-weight: 500;
		border: 0.2vh solid rgb(var(--ctp-crust));
	}
	select:focus {
		border: 0.2vh solid rgb(var(--ctp-text));
	}
	.settingsField {
		display: flex;
		align-content: center;
		justify-content: center;
		/* max-width: 80vh; */
		/* width: 60vw; */
		gap: 1vw;
	}
	h3 {
		font-size: min(3vh, 2.5vw);
	}
	.toggleButton {
		--toggleWidth: min(7vh, 7vw);
		--toggleHeight: min(3.5vh, 3.5vw);
		display: grid;
		place-items: center;
	}

	#checkboxInput,
	.checkboxDay {
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

	.checkboxDay:checked + .toggleDay,
	.checkboxDay:checked:hover + .toggleDay {
		border: solid 0.3vh rgb(var(--ctp-blue));
		color: rgb(var(--ctp-crust));
		background: rgb(var(--ctp-blue));
	}
	.checkboxDay:hover + .toggleDay {
		border: solid 0.3vh rgb(var(--ctp-blue));
		color: rgb(var(--ctp-blue));
	}
	.toggleDay {
		padding: min(0.5vh, 0.5vw) min(1.2vh, 1.2vw);
		margin: min(1vh, 1vw);
		border-radius: 1vh;
		transition-duration: 0.2s;
		border: solid 0.3vh rgb(var(--ctp-text));
		font-weight: 800;
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
	}
	h1 {
		font-size: min(5vh, 5vw);
		font-weight: 700;
	}
	input {
		color-scheme: dark;
	}
</style>
