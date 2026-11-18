/*
 * Adivasi Suraksha — English / Hindi interface text.
 * Keep sentences short and concrete: this is read on small phones, often outdoors.
 */
(function (root) {
  "use strict";

  var I18N = {
    en: {
      locale: "en-IN",
      meta: {
        title: "Adivasi Suraksha — disaster warnings for tribal India",
        description: "Live satellite fire, flood, heat, storm and earthquake alerts for 30 tribal districts of India, in English, Hindi and 10 regional languages."
      },
      appName: "Adivasi Suraksha",
      appNameAlt: "आदिवासी सुरक्षा",
      tagline: "Disaster early warning for tribal India",
      brandAria: "Adivasi Suraksha — disaster warnings for tribal districts",
      skip: "Skip to district alerts",
      nav: { label: "Sections", alerts: "Alerts", map: "Map", guides: "Safety", help: "Helplines" },
      header: {
        live: "Live",
        saved: "Saved",
        partial: "Partial",
        connecting: "Connecting",
        offline: "Offline",
        refreshTitle: "Refresh live data",
        language: "Language",
        menu: "Menu",
        menuClose: "Close menu",
        sources: "Data sources",
        sourceLive: "live",
        sourceSaved: "saved",
        sourceError: "not loading"
      },
      hero: {
        eyebrow: "Community disaster warning",
        titleA: "A warning for the",
        titleB: "last village.",
        lead: "Live satellite fire, flood, heat, storm and earthquake alerts for 30 tribal districts of India — in English, Hindi and 10 regional languages.",
        note: "Free · Works on a slow connection · No login",
        locate: "Find my district",
        browse: "Browse districts"
      },
      national: {
        label: "Today at a glance",
        needAction: "{n} districts need action",
        needActionOne: "1 district needs action",
        watchOnly: "{n} districts on watch",
        watchOnlyOne: "1 district on watch",
        clear: "All districts clear",
        highest: "Highest: {severity} {hazard} in {district}",
        loadingSub: "Fetching satellite, weather and earthquake data.",
        clearSub: "No warning-level signals right now. Keep following official updates.",
        watchSub: "Keep checking. Weather can change quickly.",
        heatDetections: "Heat detections",
        updated: "Updated {time}",
        auto: "Auto-refresh every {min} min",
        sources: "Sources"
      },
      stats: {
        label: "Hazard overview",
        fire: "Forest fire",
        rain: "Heavy rain",
        heat: "Heatwave",
        wind: "Storm",
        quake: "Earthquake",
        atAction: "{n} at warning+",
        onWatch: "{n} on watch",
        noSignal: "No signals",
        hint: "Tap a hazard to filter districts",
        filterOn: "Filtering: {hazard}"
      },
      map: {
        title: "Live hazard map",
        sub: "Satellite fires, earthquake epicentres and district status",
        reset: "Reset map",
        fires: "Fires",
        quakes: "Quakes",
        legend: "Region status",
        legendFire: "Fire detection",
        legendQuake: "Earthquake",
        latest: "Latest satellite pass: {time}",
        noFires: "No live fire detections loaded.",
        shown: "{n} fire detections",
        shownOne: "1 fire detection",
        quakesShown: "{n} earthquakes M4.5+",
        quakesShownOne: "1 earthquake M4.5+",
        firePopup: "Fire detection",
        firePopupMeta: "{distance} km from {district} · {time}",
        frp: "Fire power (FRP): {frp}",
        quakePopup: "M{mag} earthquake",
        quakeMeta: "{distance} km from {district} · {depth} km deep · {time}",
        confidence: "Confidence {value}",
        quakeLink: "USGS details",
        you: "Your location",
        tilesError: "Map background could not load. Alert lists still work.",
        tilesSwitched: "Map background switched to {provider}.",
        satelliteFailed: "Satellite view is unavailable. Showing the street map.",
        loading: "Loading map…",
        style: "Map style",
        street: "Street",
        satellite: "Satellite",
        fullscreen: "Fullscreen",
        exitFullscreen: "Exit fullscreen"
      },
      route: {
        button: "Route from my location",
        locating: "Finding your location…",
        loading: "Finding the shortest road route…",
        ready: "Route ready: {km} km",
        summary: "Bhuvan road route: {km} km to {district}",
        clear: "Clear route",
        geoDenied: "Location permission is needed to draw a route.",
        geoUnsupported: "Location is not supported on this device.",
        serverOnly: "Routing needs the local server. Run node serve.js, then try again.",
        sameState: "Bhuvan can only route between two places in the same state. Move the start point closer to this district.",
        noRoute: "Bhuvan has no road route for this district. Try a district in another state.",
        tokenExpired: "The Bhuvan token has expired. Generate a new Routing token and update config.js.",
        tokenMissing: "Bhuvan routing is not configured.",
        unavailable: "The Bhuvan routing service is unavailable right now.",
        needDistrict: "Choose a district first."
      },
      districts: {
        eyebrow: "Choose your area",
        title: "Tribal districts we watch",
        sub: "Alerts are calculated near each district centre. Tribal villages come first; nearby cities are also monitored.",
        search: "Search district, city or state",
        showing: "Showing {shown} of {total} places",
        filter: "Filter: {hazard}",
        clear: "Clear filter",
        empty: "No places match your search.",
        allClear: "No active signals",
        signals: "{n} active signals",
        signalOne: "1 active signal",
        selected: "Selected",
        view: "View",
        scopeLabel: "Places shown",
        scopeTribal: "Tribal villages",
        scopeCities: "Cities",
        scopeAll: "All places",
        centreNote: "District centre · alerts within {radius} km"
      },
      tier: {
        tribal: "Tribal",
        city: "City"
      },
      detail: {
        eyebrow: "Selected district",
        choose: "Choose a district",
        chooseSub: "Tap a district on the map or in the list to see its alerts, forecast and safety steps.",
        loading: "Loading live warnings…",
        error: "Live data is not available right now. Please check your internet and try again.",
        retry: "Try again",
        alerts: "Active signals",
        noAlerts: "No active warnings near {district} right now.",
        noAlertsSub: "Keep following official updates. Use this time to prepare.",
        forecast: "Next 3 days",
        forecastUnavailable: "Weather forecast is not available for this district right now.",
        today: "Today",
        tomorrow: "Tomorrow",
        doNow: "Do this now",
        share: "WhatsApp",
        copy: "Copy alert",
        print: "Print notice",
        copied: "Alert copied",
        radiusNote: "Alerts use the district centre and a {radius} km radius. They are guidance, not an official order.",
        updated: "Updated {time}",
        stale: "Showing saved data from {time}.",
        topAction: "Most urgent",
        allClearTitle: "No active warnings",
        prep: "Keep a torch, dry food, drinking water and important documents ready. Save 112 on your phone.",
        dataLag: "Satellite data can lag a few hours. Clouds can hide small fires."
      },
      air: {
        title: "Air quality",
        provider: "Ambee · extra reading",
        loading: "Checking nearby air quality…",
        noStation: "Ambee has no air quality station near this district right now.",
        quota: "The daily Ambee call limit has been reached. Cached readings return later.",
        notConfigured: "Air quality is not configured on this server.",
        invalidKey: "The Ambee API key was rejected. Check server-secrets.js.",
        offline: "The air quality service could not be reached.",
        network: "No connection to the local server for air quality.",
        error: "Air quality is not available right now.",
        retry: "Try again",
        note: "Extra reading only. It does not change the five-hazard alarm or the village buzzer.",
        stationDistance: "{km} km from district centre",
        mainPollutant: "Main pollutant: {pollutant}",
        categoryOnly: "US EPA air quality index",
        updated: "Station reading {time}",
        stale: "Showing the last saved reading.",
        share: "Air quality: AQI {aqi} ({category})",
        categories: {
          good: "Good",
          moderate: "Moderate",
          sensitive: "Unhealthy for sensitive groups",
          unhealthy: "Unhealthy",
          veryUnhealthy: "Very unhealthy",
          hazardous: "Hazardous",
          unknown: "Air quality index"
        }
      },
      gpm: {
        title: "Satellite rainfall",
        provider: "NASA GPM · extra reading",
        observed: "Observed rainfall",
        dateLine: "{date} · IMERG 0.1° grid",
        max: "Max",
        wet: "Wet cells",
        latency: "Delay",
        extra: "Extra",
        stale: "Showing the last saved IMERG reading.",
        note: "Satellite-observed rainfall for the latest completed day. Extra reading only. It does not change the five-hazard alarm or the village buzzer.",
        setupTitle: "NASA GPM needs one-time approval",
        setupBody: "Approve GES DISC access for the Earthdata account, then retry.",
        approve: "Approve NASA GES DISC",
        retry: "Try again",
        unavailable: "NASA IMERG has no rainfall reading for this district right now.",
        offline: "No connection to the local server for satellite rainfall.",
        error: "Satellite rainfall is not available right now.",
        share: "Satellite rainfall ({date}): {mm} mm, max {max} mm"
      },
      wider: {
        title: "Wider hazards",
        provider: "GDACS · NASA EONET · ReliefWeb · extra",
        loading: "Checking wider hazards…",
        empty: "No wider hazards reported within {radius} km right now.",
        allFailed: "Wider hazard services are not reachable right now.",
        offline: "No connection to the local server for wider hazards.",
        error: "Wider hazards are not available right now.",
        retry: "Try again",
        live: "live",
        saved: "saved",
        failed: "unavailable",
        notConfigured: "not configured",
        distance: "{km} km away",
        regional: "Regional",
        note: "Extra web-only context from GDACS, NASA EONET and ReliefWeb. It does not change the five-hazard alarm or the village buzzer.",
        share: "Wider hazards ({count})",
        types: {
          earthquake: "Earthquake",
          cyclone: "Cyclone",
          storm: "Storm",
          flood: "Flood",
          volcano: "Volcano",
          drought: "Drought",
          wildfire: "Wildfire",
          tsunami: "Tsunami",
          landslide: "Landslide",
          heat: "Extreme heat",
          dust: "Dust and haze",
          ice: "Sea or lake ice",
          snow: "Snow",
          other: "Disaster"
        }
      },
      severities: {
        safe: "Safe",
        watch: "Watch",
        warning: "Warning",
        severe: "Severe",
        status: "Status"
      },
      hazards: {
        fire: "Forest fire",
        rain: "Heavy rain",
        heat: "Heatwave",
        wind: "Storm",
        quake: "Earthquake"
      },
      alertTitles: {
        fire: "Forest fire risk",
        rain: "Heavy rain & flood risk",
        heat: "Heatwave",
        wind: "Storm & lightning",
        quake: "Earthquake"
      },
      alertDetail: {
        fireOne: "1 satellite heat detection within {radius} km in the last 24 hours. Nearest: {nearest} km away. Latest pass: {time}.",
        fire: "{count} satellite heat detections within {radius} km in the last 24 hours. Nearest: {nearest} km away. Latest pass: {time}.",
        rain: "Up to {mm} mm of rain expected on {day}. Streams and low-lying areas can flood.",
        heat: "Maximum {c}°C expected on {day}. Avoid the sun between 12 noon and 4 pm and drink water often.",
        wind: "Wind gusts up to {gust} km/h expected on {day}. Secure your roof and stay away from trees.",
        windStorm: "Thunderstorms with gusts up to {gust} km/h expected on {day}. Lightning is dangerous in the open.",
        stormOnly: "Thunderstorms are expected on {day}. Lightning is dangerous in the open.",
        quake: "Magnitude {mag} earthquake about {dist} km away on {day}. If you felt shaking, move to open ground and expect aftershocks."
      },
      weather: {
        clear: "Clear",
        partly: "Partly cloudy",
        cloudy: "Cloudy",
        fog: "Fog",
        drizzle: "Drizzle",
        rain: "Rain",
        heavyRain: "Heavy rain",
        snow: "Snow",
        storm: "Thunderstorm",
        unknown: "—",
        rainAmount: "{mm} mm",
        gust: "Gusts {kmh} km/h",
        humidity: "Humidity {p}%",
        wind: "Wind {kmh} km/h",
        highLow: "{max}° / {min}°"
      },
      guides: {
        eyebrow: "Be prepared",
        title: "Safety guides",
        sub: "Simple steps that save lives. Learn them before an emergency.",
        do: "Do",
        dont: "Don't",
        items: {
          fire: {
            title: "Forest fire",
            do: [
              "Move to an open field or cleared ground, away from dry grass and trees.",
              "Cover your nose and mouth with a wet cloth.",
              "Call 101 (fire) or 112. Tell them the village and nearest road.",
              "Move sideways to the wind, not uphill."
            ],
            dont: [
              "Do not run uphill or in the same direction as the fire.",
              "Do not enter dry forest to fight a big fire alone.",
              "Do not ignore smoke behind you."
            ]
          },
          flood: {
            title: "Flood & heavy rain",
            do: [
              "Move to higher ground as soon as water starts rising.",
              "Keep documents and your phone in a plastic bag.",
              "Listen to announcements and follow the district administration.",
              "Drink only boiled or filtered water."
            ],
            dont: [
              "Do not cross a flooded road, bridge or stream.",
              "Do not touch electric poles or wires in water.",
              "Do not drink flood water."
            ]
          },
          heat: {
            title: "Heatwave",
            do: [
              "Drink water often, even if you are not thirsty.",
              "Stay in shade between 12 noon and 4 pm.",
              "Wear light cotton clothes and cover your head.",
              "Check on older people and children."
            ],
            dont: [
              "Do not work in the open during peak heat.",
              "Do not leave children or animals in a parked vehicle.",
              "Avoid alcohol and heavy meals."
            ]
          },
          quake: {
            title: "Earthquake",
            do: [
              "Drop down, take cover under a strong table, and hold on.",
              "Stay away from walls, windows and heavy objects.",
              "After the shaking stops, move to open ground.",
              "Expect aftershocks and follow official instructions."
            ],
            dont: [
              "Do not use a lift.",
              "Do not run outside while the ground is shaking.",
              "Do not believe or spread rumours."
            ]
          },
          storm: {
            title: "Storm & lightning",
            do: [
              "Go inside a strong building as soon as clouds gather.",
              "Keep your phone and torch charged; keep dry food ready.",
              "Stay away from tall trees, poles and metal fences.",
              "If caught outside, crouch low with your feet close together."
            ],
            dont: [
              "Do not shelter under a tree or near a wire.",
              "Do not stand on a metal roof or near water.",
              "Do not go to the forest or field during a storm."
            ]
          }
        }
      },
      helplines: {
        eyebrow: "Emergency",
        title: "Save these numbers",
        sub: "Calls are free. In immediate danger, call 112 first.",
        call: "Call",
        items: [
          { num: "112", label: "National emergency", desc: "Police · Fire · Ambulance" },
          { num: "108", label: "Ambulance", desc: "Free emergency transport" },
          { num: "101", label: "Fire service", desc: "Report a fire" },
          { num: "1078", label: "Disaster helpline", desc: "NDMA control room" }
        ]
      },
      about: {
        title: "About the alerts",
        methodTitle: "How alerts are calculated",
        methodIntro: "The five-hazard alarm combines three free data services. A district is flagged when a value crosses a threshold near the district centre. Thresholds are indicative and kept simple for village use.",
        columns: { hazard: "Hazard", watch: "Watch", warning: "Warning", severe: "Severe" },
        rows: [
          { label: "Forest fire (within 40 km, 24 h)", watch: "1 detection", warning: "5", severe: "12" },
          { label: "Rain (max in 3 days)", watch: "40 mm", warning: "80 mm", severe: "120 mm" },
          { label: "Heat (plains / hills)", watch: "40°C / 30°C", warning: "43°C / 33°C", severe: "46°C / 36°C" },
          { label: "Wind gusts", watch: "50 km/h", warning: "70 km/h", severe: "90 km/h" },
          { label: "Earthquake", watch: "M5+ ≤300 km", warning: "M5.5+ ≤300 km", severe: "M6.5+ ≤600 km" },
          { label: "Air quality AQI (extra digit)", watch: "101", warning: "151", severe: "201" }
        ],
        note: "Smaller earthquakes (M4.5+) within 150 km also show as a watch. Fire alerts count satellite detections, not unique fires; one fire can be seen by more than one satellite. Air quality is sent as an extra LoRa digit (AS2) but does not raise the five-hazard alarm. NASA GPM rainfall is an extra web reading and is not sent in the LoRa packet. GDACS, NASA EONET and ReliefWeb are extra web-only context and never change the alarm.",
        sourcesTitle: "Data sources",
        sources: [
          { name: "NASA FIRMS", desc: "Near-real-time satellite fire and heat detections (MODIS and VIIRS)." },
          { name: "Open-Meteo", desc: "Free weather forecasts for rain, heat, humidity and wind." },
          { name: "USGS", desc: "Global earthquake feed, magnitude 4 and above, rolling last 7 days." },
          { name: "Esri", desc: "Street and satellite map backgrounds, with a fallback provider." },
          { name: "Bhuvan (ISRO)", desc: "Shortest road route inside one state, for the route button." },
          { name: "Ambee", desc: "Hourly air quality near the district centre (AQI and PM2.5), with a strict daily quota." },
          { name: "NASA GPM", desc: "IMERG satellite rainfall for the latest completed day, sampled near the district centre." },
          { name: "GDACS", desc: "Global disaster alerts from the European Commission and UN partners, filtered to current events near the district." },
          { name: "NASA EONET", desc: "Open natural events such as storms, floods, volcanoes and wildfires, with a local distance check." },
          { name: "ReliefWeb", desc: "Humanitarian disaster context for South Asia through the v2 API. Needs an approved appname." }
        ],
        officialTitle: "Official warnings",
        officialText: "Always check the India Meteorological Department (IMD) and the National Disaster Management Authority (NDMA). This site does not replace them.",
        disclaimerTitle: "Important",
        disclaimerText: "This is a community early-warning aid, not an official government service. Satellite and forecast data can be wrong or delayed. In an emergency, call 112 and follow your district administration."
      },
      footer: {
        made: "Built for community volunteers, teachers and health workers in India's tribal districts.",
        data: "Data: NASA FIRMS · Open-Meteo · USGS · Air: Ambee · Rain: NASA GPM · Wider: GDACS/EONET/ReliefWeb · Map: Esri · Routes: Bhuvan (ISRO)",
        disclaimer: "Not an official warning service. Emergency: 112",
        credit: "A student project for disaster resilience."
      },
      toast: {
        refreshed: "Live data refreshed",
        refreshFailed: "Could not refresh. Showing saved data.",
        copied: "Alert copied",
        copyFailed: "Could not copy the alert",
        located: "Nearest district: {district}",
        outside: "You seem to be outside the covered districts.",
        geoDenied: "Location permission was not given.",
        geoUnsupported: "Location is not supported on this device.",
        offline: "You are offline. Showing saved data if available.",
        online: "Back online. Refreshing…"
      },
      print: {
        title: "Village disaster notice",
        date: "Date: {date}",
        district: "District: {district}, {state}",
        status: "Status: {status}",
        signals: "Active signals",
        noSignals: "No active warnings at this time.",
        actions: "Do this now",
        helplines: "Emergency numbers",
        footer: "Generated by Adivasi Suraksha on {time}. This is a community aid, not an official warning. Follow IMD/NDMA and your district administration.",
        sourceLine: "Sources: NASA FIRMS, Open-Meteo, USGS."
      },
      banner: {
        title: "Some live data could not load",
        body: "Showing the last saved information. Check your internet and try again.",
        partialBody: "Some sources are unavailable; other alerts are still live. Refresh to try again.",
        retry: "Retry",
        dismiss: "Dismiss"
      }
    },

    hi: {
      locale: "hi-IN",
      meta: {
        title: "आदिवासी सुरक्षा — आदिवासी भारत के लिए आपदा चेतावनी",
        description: "भारत के 30 आदिवासी जिलों के लिए जंगल की आग, बाढ़, लू, आंधी और भूकंप की लाइव चेतावनी, अंग्रेज़ी, हिंदी और 10 क्षेत्रीय भाषाओं में।"
      },
      appName: "आदिवासी सुरक्षा",
      appNameAlt: "Adivasi Suraksha",
      tagline: "आदिवासी भारत के लिए आपदा चेतावनी",
      brandAria: "आदिवासी सुरक्षा — आदिवासी जिलों के लिए आपदा चेतावनी",
      skip: "सीधे जिला चेतावनी पर जाएँ",
      nav: { label: "विभाग", alerts: "चेतावनी", map: "नक्शा", guides: "सुरक्षा", help: "हेल्पलाइन" },
      header: {
        live: "लाइव",
        saved: "सहेजा",
        partial: "आंशिक",
        connecting: "जुड़ रहा है",
        offline: "ऑफ़लाइन",
        refreshTitle: "लाइव डेटा रीफ़्रेश करें",
        language: "भाषा",
        menu: "मेनू",
        menuClose: "मेनू बंद करें",
        sources: "डेटा स्रोत",
        sourceLive: "लाइव",
        sourceSaved: "सहेजा",
        sourceError: "नहीं मिल रहा"
      },
      hero: {
        eyebrow: "सामुदायिक आपदा चेतावनी",
        titleA: "आख़िरी गाँव तक",
        titleB: "चेतावनी।",
        lead: "भारत के 30 आदिवासी जिलों के लिए जंगल की आग, बाढ़, लू, आंधी और भूकंप की लाइव चेतावनी — अंग्रेज़ी, हिंदी और 10 क्षेत्रीय भाषाओं में।",
        note: "मुफ़्त · धीमे इंटरनेट पर भी काम करता है · लॉगिन नहीं",
        locate: "मेरा जिला खोजें",
        browse: "जिले देखें"
      },
      national: {
        label: "आज एक नज़र में",
        needAction: "{n} जिलों में कार्रवाई ज़रूरी",
        needActionOne: "1 जिले में कार्रवाई ज़रूरी",
        watchOnly: "{n} जिले निगरानी में",
        watchOnlyOne: "1 जिला निगरानी में",
        clear: "सभी जिले सुरक्षित",
        highest: "सबसे ऊँचा स्तर: {district} में {severity} {hazard}",
        loadingSub: "सैटेलाइट, मौसम और भूकंप का डेटा आ रहा है।",
        clearSub: "अभी चेतावनी स्तर का कोई संकेत नहीं। आधिकारिक अपडेट देखते रहें।",
        watchSub: "नज़र बनाए रखें। मौसम तेज़ी से बदल सकता है।",
        heatDetections: "आग के हॉटस्पॉट",
        updated: "अपडेट: {time}",
        auto: "हर {min} मिनट में अपडेट",
        sources: "स्रोत"
      },
      stats: {
        label: "खतरों का सार",
        fire: "जंगल की आग",
        rain: "भारी बारिश",
        heat: "लू",
        wind: "आंधी-तूफ़ान",
        quake: "भूकंप",
        atAction: "{n} चेतावनी स्तर पर",
        onWatch: "{n} निगरानी में",
        noSignal: "कोई संकेत नहीं",
        hint: "जिले छाँटने के लिए खतरे पर टैप करें",
        filterOn: "फ़िल्टर: {hazard}"
      },
      map: {
        title: "लाइव खतरा नक्शा",
        sub: "सैटेलाइट आग, भूकंप के केंद्र और जिलों की स्थिति",
        reset: "नक्शा रीसेट करें",
        fires: "आग",
        quakes: "भूकंप",
        legend: "जिले की स्थिति",
        legendFire: "आग का धब्बा",
        legendQuake: "भूकंप",
        latest: "सबसे नया सैटेलाइट पास: {time}",
        noFires: "अभी आग का कोई लाइव डेटा नहीं।",
        shown: "{n} आग के धब्बे",
        shownOne: "1 आग का धब्बा",
        quakesShown: "{n} भूकंप (M4.5+)",
        quakesShownOne: "1 भूकंप (M4.5+)",
        firePopup: "आग का धब्बा",
        firePopupMeta: "{district} से {distance} किमी · {time}",
        frp: "आग की तीव्रता (FRP): {frp}",
        quakePopup: "M{mag} भूकंप",
        quakeMeta: "{district} से {distance} किमी · {depth} किमी गहरा · {time}",
        confidence: "विश्वास स्तर {value}",
        quakeLink: "USGS विवरण",
        you: "आपकी लोकेशन",
        tilesError: "नक्शे की पृष्ठभूमि नहीं आ सकी। चेतावनी सूची फिर भी काम करेगी।",
        tilesSwitched: "नक्शे की पृष्ठभूमि {provider} पर बदल दी गई।",
        satelliteFailed: "सैटेलाइट दृश्य उपलब्ध नहीं है। सड़क वाला नक्शा दिखाया जा रहा है।",
        loading: "नक्शा लोड हो रहा है…",
        style: "नक्शे की शैली",
        street: "सड़क",
        satellite: "सैटेलाइट",
        fullscreen: "पूरी स्क्रीन",
        exitFullscreen: "पूरी स्क्रीन से बाहर"
      },
      route: {
        button: "मेरी लोकेशन से रास्ता",
        locating: "आपकी लोकेशन खोजी जा रही है…",
        loading: "सबसे छोटा सड़क मार्ग खोजा जा रहा है…",
        ready: "रास्ता तैयार: {km} किमी",
        summary: "भुवन सड़क मार्ग: {district} तक {km} किमी",
        clear: "रास्ता हटाएँ",
        geoDenied: "रास्ता दिखाने के लिए लोकेशन की अनुमति चाहिए।",
        geoUnsupported: "इस डिवाइस पर लोकेशन उपलब्ध नहीं है।",
        serverOnly: "रास्ते के लिए स्थानीय सर्वर चलाना होगा। node serve.js चलाएँ और फिर कोशिश करें।",
        sameState: "भुवन सिर्फ़ एक ही राज्य के दो स्थानों के बीच रास्ता दिखाता है। शुरुआती जगह को जिले के करीब लाएँ।",
        noRoute: "इस जिले के लिए भुवन का सड़क मार्ग नहीं मिला। दूसरे राज्य का जिला आज़माएँ।",
        tokenExpired: "भुवन टोकन की अवधि खत्म हो गई है। नया रूटिंग टोकन बनाकर config.js में डालें।",
        tokenMissing: "भुवन रूटिंग सेट नहीं है।",
        unavailable: "भुवन रूटिंग सेवा अभी उपलब्ध नहीं है।",
        needDistrict: "पहले जिला चुनें।"
      },
      districts: {
        eyebrow: "अपना क्षेत्र चुनें",
        title: "हम जिन आदिवासी जिलों पर नज़र रखते हैं",
        sub: "चेतावनी हर जिला केंद्र के पास निकाली जाती है। आदिवासी गाँव पहले आते हैं; आसपास के शहरों पर भी नज़र रखी जाती है।",
        search: "जिला, शहर या राज्य खोजें",
        showing: "{total} में से {shown} स्थान",
        filter: "फ़िल्टर: {hazard}",
        clear: "फ़िल्टर हटाएँ",
        empty: "आपकी खोज से कोई स्थान नहीं मिला।",
        allClear: "कोई सक्रिय संकेत नहीं",
        signals: "{n} सक्रिय संकेत",
        signalOne: "1 सक्रिय संकेत",
        selected: "चुना गया",
        view: "देखें",
        scopeLabel: "कौन से स्थान",
        scopeTribal: "आदिवासी गाँव",
        scopeCities: "शहर",
        scopeAll: "सभी स्थान",
        centreNote: "जिला केंद्र · {radius} किमी के भीतर चेतावनी"
      },
      tier: {
        tribal: "आदिवासी",
        city: "शहर"
      },
      detail: {
        eyebrow: "चुना गया जिला",
        choose: "जिला चुनें",
        chooseSub: "चेतावनी, मौसम और सुरक्षा के कदम देखने के लिए नक्शे या सूची में जिले पर टैप करें।",
        loading: "लाइव चेतावनी लोड हो रही है…",
        error: "अभी लाइव डेटा नहीं मिल रहा। इंटरनेट जाँचें और फिर कोशिश करें।",
        retry: "फिर कोशिश करें",
        alerts: "सक्रिय संकेत",
        noAlerts: "{district} के पास अभी कोई सक्रिय चेतावनी नहीं।",
        noAlertsSub: "आधिकारिक अपडेट देखते रहें। इस समय तैयारी करें।",
        forecast: "अगले 3 दिन",
        forecastUnavailable: "इस जिले का मौसम पूर्वानुमान अभी उपलब्ध नहीं है।",
        today: "आज",
        tomorrow: "कल",
        doNow: "अभी यह करें",
        share: "व्हाट्सऐप",
        copy: "चेतावनी कॉपी करें",
        print: "नोटिस छापें",
        copied: "चेतावनी कॉपी हो गई",
        radiusNote: "चेतावनी जिला केंद्र से {radius} किमी के दायरे पर आधारित है। यह मार्गदर्शन है, आधिकारिक आदेश नहीं।",
        updated: "अपडेट: {time}",
        stale: "{time} का सहेजा डेटा दिख रहा है।",
        topAction: "सबसे ज़रूरी",
        allClearTitle: "कोई सक्रिय चेतावनी नहीं",
        prep: "टॉर्च, सूखा भोजन, पीने का पानी और ज़रूरी कागज़ तैयार रखें। फ़ोन में 112 सेव करें।",
        dataLag: "सैटेलाइट डेटा कुछ घंटे पुराना हो सकता है। बादल छोटी आग छिपा सकते हैं।"
      },
      air: {
        title: "हवा की गुणवत्ता",
        provider: "Ambee · अतिरिक्त जानकारी",
        loading: "आसपास की हवा की गुणवत्ता देखी जा रही है…",
        noStation: "इस जिले के पास अभी Ambee का वायु गुणवत्ता केंद्र नहीं है।",
        quota: "Ambee की रोज़ की कॉल सीमा पूरी हो गई। सहेजी गई रीडिंग बाद में मिलेगी।",
        notConfigured: "इस सर्वर पर वायु गुणवत्ता सेट नहीं है।",
        invalidKey: "Ambee API कुंजी अस्वीकार हुई। server-secrets.js जाँचें।",
        offline: "वायु गुणवत्ता सेवा से संपर्क नहीं हो सका।",
        network: "वायु गुणवत्ता के लिए स्थानीय सर्वर से कनेक्शन नहीं है।",
        error: "वायु गुणवत्ता अभी उपलब्ध नहीं है।",
        retry: "फिर कोशिश करें",
        note: "यह केवल अतिरिक्त जानकारी है। इससे पाँच खतरों का अलार्म या गाँव का बज़र नहीं बदलता।",
        stationDistance: "जिला केंद्र से {km} किमी",
        mainPollutant: "मुख्य प्रदूषक: {pollutant}",
        categoryOnly: "US EPA वायु गुणवत्ता सूचकांक",
        updated: "केंद्र की रीडिंग {time}",
        stale: "सबसे पहले सहेजी गई रीडिंग दिख रही है।",
        share: "हवा की गुणवत्ता: AQI {aqi} ({category})",
        categories: {
          good: "अच्छी",
          moderate: "मध्यम",
          sensitive: "संवेदनशील लोगों के लिए हानिकारक",
          unhealthy: "हानिकारक",
          veryUnhealthy: "बहुत हानिकारक",
          hazardous: "खतरनाक",
          unknown: "वायु गुणवत्ता सूचकांक"
        }
      },
      gpm: {
        title: "उपग्रह वर्षा",
        provider: "NASA GPM · अतिरिक्त जानकारी",
        observed: "दर्ज वर्षा",
        dateLine: "{date} · IMERG 0.1° ग्रिड",
        max: "अधिकतम",
        wet: "वर्षा वाले क्षेत्र",
        latency: "देरी",
        extra: "अतिरिक्त",
        stale: "सबसे पहले सहेजी गई IMERG रीडिंग दिख रही है।",
        note: "यह पिछले पूरे दिन की उपग्रह-मापी वर्षा है। यह केवल अतिरिक्त जानकारी है और पाँच खतरों का अलार्म या गाँव का बज़र नहीं बदलती।",
        setupTitle: "NASA GPM के लिए एक बार अनुमति चाहिए",
        setupBody: "Earthdata खाते के लिए GES DISC की अनुमति दें, फिर कोशिश करें।",
        approve: "NASA GES DISC अनुमति दें",
        retry: "फिर कोशिश करें",
        unavailable: "इस जिले के लिए NASA IMERG के पास अभी वर्षा की रीडिंग नहीं है।",
        offline: "उपग्रह वर्षा के लिए स्थानीय सर्वर से कनेक्शन नहीं है।",
        error: "उपग्रह वर्षा अभी उपलब्ध नहीं है।",
        share: "उपग्रह वर्षा ({date}): {mm} मिमी, अधिकतम {max} मिमी"
      },
      wider: {
        title: "आसपास के अन्य खतरे",
        provider: "GDACS · NASA EONET · ReliefWeb · अतिरिक्त",
        loading: "अन्य खतरे देखे जा रहे हैं…",
        empty: "अभी {radius} किमी के भीतर कोई अन्य खतरा दर्ज नहीं है।",
        allFailed: "अन्य खतरों की सेवाएँ अभी नहीं मिल रहीं।",
        offline: "अन्य खतरों के लिए स्थानीय सर्वर से कनेक्शन नहीं है।",
        error: "अन्य खतरे अभी उपलब्ध नहीं हैं।",
        retry: "फिर कोशिश करें",
        live: "लाइव",
        saved: "सहेजा",
        failed: "उपलब्ध नहीं",
        notConfigured: "सेट नहीं",
        distance: "{km} किमी दूर",
        regional: "क्षेत्रीय",
        note: "यह GDACS, NASA EONET और ReliefWeb से केवल वेब पर मिलने वाली अतिरिक्त जानकारी है। इससे पाँच खतरों का अलार्म या गाँव का बज़र नहीं बदलता।",
        share: "आसपास के अन्य खतरे ({count})",
        types: {
          earthquake: "भूकंप",
          cyclone: "चक्रवात",
          storm: "तूफ़ान",
          flood: "बाढ़",
          volcano: "ज्वालामुखी",
          drought: "सूखा",
          wildfire: "जंगल की आग",
          tsunami: "सुनामी",
          landslide: "भूस्खलन",
          heat: "अत्यधिक गर्मी",
          dust: "धूल और धुँध",
          ice: "समुद्री या झील की बर्फ़",
          snow: "बर्फ़बारी",
          other: "आपदा"
        }
      },
      severities: {
        safe: "सुरक्षित",
        watch: "ध्यान दें",
        warning: "चेतावनी",
        severe: "गंभीर",
        status: "स्थिति"
      },
      hazards: {
        fire: "जंगल की आग",
        rain: "भारी बारिश",
        heat: "लू",
        wind: "आंधी-तूफ़ान",
        quake: "भूकंप"
      },
      alertTitles: {
        fire: "जंगल में आग का खतरा",
        rain: "भारी बारिश और बाढ़ का खतरा",
        heat: "लू का खतरा",
        wind: "आंधी और बिजली",
        quake: "भूकंप"
      },
      alertDetail: {
        fireOne: "पिछले 24 घंटे में {radius} किमी के भीतर सैटेलाइट से 1 आग का धब्बा मिला। सबसे नज़दीक: {nearest} किमी दूर। सबसे नया पास: {time}।",
        fire: "पिछले 24 घंटे में {radius} किमी के भीतर सैटेलाइट से {count} आग के धब्बे मिले। सबसे नज़दीक: {nearest} किमी दूर। सबसे नया पास: {time}।",
        rain: "{day} को {mm} मिमी तक बारिश हो सकती है। नाले और निचली जगहों में बाढ़ आ सकती है।",
        heat: "{day} को अधिकतम {c}°C तक गर्मी पड़ सकती है। दोपहर 12 से 4 बजे तक धूप से बचें और पानी पीते रहें।",
        wind: "{day} को हवा के झोंके {gust} किमी/घंटा तक पहुँच सकते हैं। छत मज़बूत करें और पेड़ों से दूर रहें।",
        windStorm: "{day} को आंधी-तूफ़ान और {gust} किमी/घंटा तक के झोंके आ सकते हैं। खुले में बिजली गिरना खतरनाक है।",
        stormOnly: "{day} को आंधी-तूफ़ान आ सकता है। खुले में बिजली गिरना खतरनाक है।",
        quake: "{day} को लगभग {dist} किमी दूर {mag} तीव्रता का भूकंप आया। अगर झटके महसूस हुए, खुले मैदान में जाएँ और बाद के झटकों के लिए तैयार रहें।"
      },
      weather: {
        clear: "साफ़",
        partly: "कुछ बादल",
        cloudy: "बादल",
        fog: "कोहरा",
        drizzle: "फुहार",
        rain: "बारिश",
        heavyRain: "भारी बारिश",
        snow: "बर्फ़",
        storm: "आंधी-तूफ़ान",
        unknown: "—",
        rainAmount: "{mm} मिमी",
        gust: "झोंके {kmh} किमी/घंटा",
        humidity: "नमी {p}%",
        wind: "हवा {kmh} किमी/घंटा",
        highLow: "{max}° / {min}°"
      },
      guides: {
        eyebrow: "तैयार रहें",
        title: "सुरक्षा गाइड",
        sub: "आसान कदम जो जान बचाते हैं। आपात स्थिति से पहले सीख लें।",
        do: "करें",
        dont: "न करें",
        items: {
          fire: {
            title: "जंगल की आग",
            do: [
              "सूखी घास और पेड़ों से दूर, खुले मैदान या साफ जगह पर जाएँ।",
              "गीले कपड़े से नाक और मुँह ढकें।",
              "101 (दमकल) या 112 पर कॉल करें। गाँव और नज़दीकी सड़क का नाम बताएँ।",
              "हवा की दिशा देखें — आग के बगल में जाएँ, ऊपर की ओर नहीं।"
            ],
            dont: [
              "आग की दिशा में या पहाड़ी की ओर न भागें।",
              "बड़ी आग बुझाने अकेले घने सूखे जंगल में न जाएँ।",
              "पीछे लगी आग की अनदेखी न करें।"
            ]
          },
          flood: {
            title: "बाढ़ और भारी बारिश",
            do: [
              "पानी बढ़ते ही तुरंत ऊँची जगह पर जाएँ।",
              "कागज़ और फ़ोन को प्लास्टिक की थैली में रखें।",
              "घोषणाएँ सुनें और जिला प्रशासन का पालन करें।",
              "सिर्फ़ उबला या छना हुआ पानी पिएँ।"
            ],
            dont: [
              "बाढ़ वाली सड़क, पुल या नाले को पार न करें।",
              "पानी में बिजली के खंभे या तार न छुएँ।",
              "बाढ़ का पानी न पिएँ।"
            ]
          },
          heat: {
            title: "लू",
            do: [
              "प्यास न लगे तब भी पानी पीते रहें।",
              "दोपहर 12 से 4 बजे तक छाया में रहें।",
              "हल्के सूती कपड़े पहनें और सिर ढकें।",
              "बुज़ुर्गों और बच्चों का ध्यान रखें।"
            ],
            dont: [
              "तेज़ गर्मी में खुले में काम न करें।",
              "बच्चों या जानवरों को खड़ी गाड़ी में न छोड़ें।",
              "शराब और भारी खाने से बचें।"
            ]
          },
          quake: {
            title: "भूकंप",
            do: [
              "झुकें, मज़बूत मेज़ के नीचे जाएँ और पकड़ बनाए रखें।",
              "दीवार, खिड़की और भारी सामान से दूर रहें।",
              "झटके रुकने के बाद खुले मैदान में जाएँ।",
              "बाद के झटकों के लिए तैयार रहें और आधिकारिक निर्देश मानें।"
            ],
            dont: [
              "लिफ़्ट का इस्तेमाल न करें।",
              "झटकों के समय बाहर भागें नहीं।",
              "अफ़वाहों पर विश्वास न करें और न फैलाएँ।"
            ]
          },
          storm: {
            title: "आंधी और बिजली",
            do: [
              "बादल घिरते ही मज़बूत पक्के मकान में जाएँ।",
              "फ़ोन और टॉर्च चार्ज रखें; सूखा भोजन तैयार रखें।",
              "ऊँचे पेड़, खंभे और धातु की बाड़ से दूर रहें।",
              "अगर बाहर फँसें, तो पैर पास रखकर नीचे झुकें।"
            ],
            dont: [
              "पेड़ के नीचे या तार के पास न खड़े हों।",
              "धातु की छत पर या पानी के पास न खड़े हों।",
              "आंधी के समय जंगल या खेत में न जाएँ।"
            ]
          }
        }
      },
      helplines: {
        eyebrow: "आपातकाल",
        title: "ये नंबर सेव करें",
        sub: "कॉल मुफ़्त हैं। तुरंत खतरे में पहले 112 पर कॉल करें।",
        call: "कॉल करें",
        items: [
          { num: "112", label: "राष्ट्रीय आपातकाल", desc: "पुलिस · दमकल · एम्बुलेंस" },
          { num: "108", label: "एम्बुलेंस", desc: "मुफ़्त आपातकालीन वाहन" },
          { num: "101", label: "दमकल सेवा", desc: "आग की सूचना दें" },
          { num: "1078", label: "आपदा हेल्पलाइन", desc: "NDMA कंट्रोल रूम" }
        ]
      },
      about: {
        title: "चेतावनी के बारे में",
        methodTitle: "चेतावनी कैसे निकाली जाती है",
        methodIntro: "पाँच खतरों का अलार्म तीन मुफ़्त डेटा सेवाओं को जोड़ता है। जिला केंद्र के पास कोई मान सीमा पार करने पर जिले को चिह्नित किया जाता है। सीमाएँ सांकेतिक और गाँव के इस्तेमाल के लिए सरल रखी गई हैं।",
        columns: { hazard: "खतरा", watch: "ध्यान दें", warning: "चेतावनी", severe: "गंभीर" },
        rows: [
          { label: "जंगल की आग (40 किमी के भीतर, 24 घंटे)", watch: "1 धब्बा", warning: "5", severe: "12" },
          { label: "बारिश (3 दिन में अधिकतम)", watch: "40 मिमी", warning: "80 मिमी", severe: "120 मिमी" },
          { label: "गर्मी (मैदान / पहाड़)", watch: "40°C / 30°C", warning: "43°C / 33°C", severe: "46°C / 36°C" },
          { label: "हवा के झोंके", watch: "50 किमी/घंटा", warning: "70 किमी/घंटा", severe: "90 किमी/घंटा" },
          { label: "भूकंप", watch: "M5+ ≤300 किमी", warning: "M5.5+ ≤300 किमी", severe: "M6.5+ ≤600 किमी" },
          { label: "वायु गुणवत्ता AQI (अतिरिक्त अंक)", watch: "101", warning: "151", severe: "201" }
        ],
        note: "150 किमी के भीतर M4.5+ के छोटे भूकंप भी निगरानी में दिखते हैं। आग की चेतावनी में सैटेलाइट धब्बों की गिनती होती है, अलग-अलग आग की नहीं; एक ही आग कई सैटेलाइट देख सकते हैं। वायु गुणवत्ता LoRa में एक अतिरिक्त अंक (AS2) के रूप में जाती है, पर पाँच खतरों का अलार्म नहीं बढ़ाती। NASA GPM वर्षा केवल वेब पर अतिरिक्त जानकारी है और LoRa पैकेट में नहीं जाती। GDACS, NASA EONET और ReliefWeb भी केवल वेब पर अतिरिक्त जानकारी हैं और अलार्म नहीं बदलते।",
        sourcesTitle: "डेटा स्रोत",
        sources: [
          { name: "NASA FIRMS", desc: "लगभग वास्तविक समय में सैटेलाइट से आग और गर्मी के धब्बे (MODIS और VIIRS)।" },
          { name: "Open-Meteo", desc: "बारिश, गर्मी, नमी और हवा का मुफ़्त मौसम पूर्वानुमान।" },
          { name: "USGS", desc: "दुनिया भर के भूकंप, 4 तीव्रता और ऊपर, पिछले 7 दिन।" },
          { name: "Esri", desc: "सड़क और सैटेलाइट नक्शे की पृष्ठभूमि, साथ में बैकअप स्रोत।" },
          { name: "भुवन (ISRO)", desc: "एक ही राज्य के भीतर सबसे छोटा सड़क मार्ग, रास्ता बटन के लिए।" },
          { name: "Ambee", desc: "जिला केंद्र के पास हर घंटे की वायु गुणवत्ता (AQI और PM2.5), सख्त रोज़ की सीमा के साथ।" },
          { name: "NASA GPM", desc: "पिछले पूरे दिन की IMERG उपग्रह वर्षा, जिला केंद्र के पास से ली गई।" },
          { name: "GDACS", desc: "यूरोपीय आयोग और संयुक्त राष्ट्र साझेदारों की वैश्विक आपदा चेतावनी, जिले के पास की मौजूदा घटनाओं के लिए छाँटी गई।" },
          { name: "NASA EONET", desc: "तूफ़ान, बाढ़, ज्वालामुखी और जंगल की आग जैसी खुली प्राकृतिक घटनाएँ, स्थानीय दूरी की जाँच के साथ।" },
          { name: "ReliefWeb", desc: "दक्षिण एशिया के मानवीय आपदा संदर्भ, v2 API से। इसके लिए स्वीकृत appname चाहिए।" }
        ],
        officialTitle: "आधिकारिक चेतावनी",
        officialText: "हमेशा भारत मौसम विज्ञान विभाग (IMD) और राष्ट्रीय आपदा प्रबंधन प्राधिकरण (NDMA) की चेतावनी देखें। यह साइट उनकी जगह नहीं है।",
        disclaimerTitle: "ज़रूरी बात",
        disclaimerText: "यह एक सामुदायिक चेतावनी सहायता है, सरकारी सेवा नहीं। सैटेलाइट और मौसम डेटा गलत या देर से हो सकता है। आपात स्थिति में 112 पर कॉल करें और जिला प्रशासन का पालन करें।"
      },
      footer: {
        made: "भारत के आदिवासी जिलों के सामुदायिक स्वयंसेवकों, शिक्षकों और स्वास्थ्य कर्मियों के लिए बनाया गया।",
        data: "डेटा: NASA FIRMS · Open-Meteo · USGS · हवा: Ambee · वर्षा: NASA GPM · अन्य खतरे: GDACS/EONET/ReliefWeb · नक्शा: Esri · रास्ता: भुवन (ISRO)",
        disclaimer: "आधिकारिक चेतावनी सेवा नहीं। आपातकाल: 112",
        credit: "आपदा सहनशीलता के लिए एक छात्र परियोजना।"
      },
      toast: {
        refreshed: "लाइव डेटा अपडेट हुआ",
        refreshFailed: "अपडेट नहीं हो सका। सहेजा डेटा दिख रहा है।",
        copied: "चेतावनी कॉपी हो गई",
        copyFailed: "चेतावनी कॉपी नहीं हो सकी",
        located: "नज़दीकी जिला चुना: {district}",
        outside: "आप चुने गए जिलों के बाहर लगते हैं।",
        geoDenied: "लोकेशन की अनुमति नहीं मिली।",
        geoUnsupported: "इस डिवाइस पर लोकेशन उपलब्ध नहीं।",
        offline: "आप ऑफ़लाइन हैं। सहेजा डेटा दिखाया जाएगा।",
        online: "इंटरनेट वापस आया। अपडेट हो रहा है…"
      },
      print: {
        title: "गाँव आपदा सूचना",
        date: "दिनांक: {date}",
        district: "जिला: {district}, {state}",
        status: "स्थिति: {status}",
        signals: "सक्रिय संकेत",
        noSignals: "इस समय कोई सक्रिय चेतावनी नहीं।",
        actions: "अभी यह करें",
        helplines: "आपातकालीन नंबर",
        footer: "यह सूचना आदिवासी सुरक्षा द्वारा {time} पर बनाई गई। यह सामुदायिक सहायता है, आधिकारिक चेतावनी नहीं। IMD/NDMA और जिला प्रशासन का पालन करें।",
        sourceLine: "स्रोत: NASA FIRMS, Open-Meteo, USGS।"
      },
      banner: {
        title: "कुछ लाइव डेटा नहीं आ सका",
        body: "पिछली सहेजी जानकारी दिख रही है। इंटरनेट जाँचें और फिर कोशिश करें।",
        partialBody: "कुछ स्रोत अभी नहीं मिल रहे; बाकी चेतावनी लाइव हैं। रीफ़्रेश करके फिर कोशिश करें।",
        retry: "फिर कोशिश करें",
        dismiss: "हटाएँ"
      }
    }
  };

  /*
   * Regional language packs (i18n.langs.js) are partial: each supplies the
   * high-visibility strings and inherits the rest from Hindi, then English.
   * The resolver builds one complete dictionary per language at load time so a
   * missing key never shows a raw key or breaks a nested lookup.
   */
  var packs = root.APP_LANGS;
  if (!packs && typeof require === "function") {
    try { packs = require("./i18n.langs"); } catch (error) { packs = null; }
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function deepMerge(base, override) {
    var out = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key];
    }
    for (key in override) {
      if (!Object.prototype.hasOwnProperty.call(override, key)) continue;
      out[key] = isPlainObject(out[key]) && isPlainObject(override[key])
        ? deepMerge(out[key], override[key])
        : override[key];
    }
    return out;
  }

  if (packs) {
    Object.keys(packs).forEach(function (code) {
      if (code === "meta" || code === "regionNames" || code === "stateNames") return;
      if (code === "en" || code === "hi") return;
      if (isPlainObject(packs[code])) I18N[code] = packs[code];
    });
    I18N.languages = Array.isArray(packs.meta) ? packs.meta : [];
    I18N.regionNames = packs.regionNames || {};
    I18N.stateNames = packs.stateNames || {};
  } else {
    I18N.languages = [
      { code: "en", short: "EN", label: "English", english: "English", locale: "en-IN" },
      { code: "hi", short: "हिं", label: "हिन्दी", english: "Hindi", locale: "hi-IN" }
    ];
    I18N.regionNames = {};
    I18N.stateNames = {};
  }

  I18N.resolved = {};
  I18N.languages.forEach(function (item) {
    var code = item && item.code;
    if (!code || !I18N[code]) return;
    var merged = deepMerge(I18N.en, I18N.hi);
    if (code === "en") merged = I18N.en;
    else if (code !== "hi") merged = deepMerge(merged, I18N[code]);
    I18N.resolved[code] = merged;
  });

  root.APP_I18N = I18N;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = I18N;
  }
})(typeof window !== "undefined" ? window : globalThis);
