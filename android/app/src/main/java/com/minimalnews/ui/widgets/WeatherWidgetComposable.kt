package com.minimalnews.ui.widgets

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.minimalnews.data.models.WeatherData
import com.minimalnews.data.repository.Repository
import com.minimalnews.ui.components.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

private data class IpInfo(
    val city: String?,
    val region: String?,
    @com.google.gson.annotations.SerializedName("country_name")
    val countryName: String?,
    val country: String?
)

@SuppressLint("MissingPermission")
@Composable
fun WeatherWidgetComposable(repository: Repository) {
    var weather by remember { mutableStateOf<WeatherData?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val savedLocation = remember {
        repository.prefs.getString("weather_location", "") ?: ""
    }
    var locationInput by remember { mutableStateOf(savedLocation) }
    var locating by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun loadWeather(location: String) {
        if (location.isBlank()) return
        scope.launch {
            loading = true; error = null
            try {
                weather = repository.fetchWeather(location)
                repository.saveWidgetData("weather_location", location)
            } catch (e: Exception) {
                error = e.message ?: "Failed to load weather"
            }
            loading = false
        }
    }

    suspend fun locateByIp(): String? {
        return withContext(Dispatchers.IO) {
            try {
                val data = java.net.URL("https://ipapi.co/json/").readText()
                data.takeIf { it.isNotBlank() }?.let {
                    data
                } ?: null
            } catch (e: Exception) {
                null
            }
        }?.let { json ->
            try {
                val info = Gson().fromJson(json, IpInfo::class.java)
                info.city?.takeIf { it.isNotBlank() }
                    ?: info.region?.takeIf { it.isNotBlank() }
                    ?: info.countryName?.takeIf { it.isNotBlank() }
                    ?: info.country?.takeIf { it.isNotBlank() }
            } catch (e: Exception) {
                null
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun autoDetectLocation() {
        locating = true; error = null
        scope.launch(Dispatchers.IO) {
            try {
                val lm = context.getSystemService(LocationManager::class.java)
                val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
                var lat: Double? = null; var lon: Double? = null

                for (provider in providers) {
                    if (lm.isProviderEnabled(provider)) {
                        val loc = lm.getLastKnownLocation(provider)
                        if (loc != null) { lat = loc.latitude; lon = loc.longitude; break }
                    }
                }

                if (lat != null && lon != null) {
                    val geocoder = Geocoder(context, Locale.getDefault())
                    @Suppress("DEPRECATION")
                    val addresses = geocoder.getFromLocation(lat, lon, 1)
                    val cityName = addresses?.firstOrNull()?.let { addr ->
                        addr.locality ?: addr.subAdminArea ?: addr.adminArea
                    } ?: "$lat,$lon"
                    withContext(Dispatchers.Main) {
                        locationInput = cityName
                        locating = false
                        loadWeather(cityName)
                    }
                } else {
                    val ipLocation = locateByIp()
                    withContext(Dispatchers.Main) {
                        if (!ipLocation.isNullOrBlank()) {
                            locationInput = ipLocation
                            loadWeather(ipLocation)
                            error = "Using IP fallback location: $ipLocation"
                        } else {
                            error = "Could not get location — enter city manually"
                        }
                        locating = false
                    }
                }
            } catch (e: Exception) {
                val ipLocation = locateByIp()
                withContext(Dispatchers.Main) {
                    if (!ipLocation.isNullOrBlank()) {
                        locationInput = ipLocation
                        loadWeather(ipLocation)
                        error = "Using IP fallback location: $ipLocation"
                    } else {
                        error = "Location error: ${e.message}"
                    }
                    locating = false
                }
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) {
            autoDetectLocation()
        } else {
            locating = true
            error = null
            scope.launch {
                val ipLocation = locateByIp()
                withContext(Dispatchers.Main) {
                    if (!ipLocation.isNullOrBlank()) {
                        locationInput = ipLocation
                        loadWeather(ipLocation)
                        error = "Location permission denied — using IP fallback: $ipLocation"
                    } else {
                        error = "Location permission denied — enter city manually"
                    }
                    locating = false
                }
            }
        }
    }

    // Load saved location on first composition
    LaunchedEffect(Unit) {
        if (savedLocation.isNotBlank()) loadWeather(savedLocation)
    }

    TerminalBox(
        title = "weather",
        status = weather?.location ?: "",
        onRefresh = { loadWeather(locationInput) }
    ) {
        // Location input row
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "$ ",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.secondary
            )
            OutlinedTextField(
                value = locationInput,
                onValueChange = { locationInput = it },
                textStyle = MaterialTheme.typography.bodyMedium.copy(
                    color = MaterialTheme.colorScheme.onBackground
                ),
                placeholder = {
                    Text(
                        "Enter city...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                    )
                },
                singleLine = true,
                modifier = Modifier
                    .weight(1f),

                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Search
                ),
                keyboardActions = KeyboardActions(onSearch = {
                    loadWeather(locationInput)
                }),
                visualTransformation = VisualTransformation.None,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = MaterialTheme.colorScheme.onBackground,
                    unfocusedTextColor = MaterialTheme.colorScheme.onBackground,
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                    cursorColor = MaterialTheme.colorScheme.primary,
                )
            )
            Spacer(Modifier.width(6.dp))
            // GPS auto-detect button
            Text(
                text = if (locating) "…" else "⊕",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable {
                    val hasFine = ContextCompat.checkSelfPermission(
                        context, Manifest.permission.ACCESS_FINE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED
                    val hasCoarse = ContextCompat.checkSelfPermission(
                        context, Manifest.permission.ACCESS_COARSE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED
                    if (hasFine || hasCoarse) {
                        autoDetectLocation()
                    } else {
                        permissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }
                }
            )
        }

        Spacer(Modifier.height(12.dp))

        when {
            locating -> TerminalLoading("Getting your location...")
            loading -> TerminalLoading("Fetching weather data...")
            locationInput.isBlank() && weather == null ->
                Text(
                    "Enter a city or tap ⊕ to detect location",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            error != null -> TerminalError(error!!)
            weather != null -> {
                val w = weather!!
                // Current weather
                Text(
                    text = "${w.current.icon} ${w.current.temp.toInt()}°C — ${w.current.condition}",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Feels like ${w.current.feelsLike.toInt()}°C",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(8.dp))

                // Details
                val details = listOf(
                    "Humidity" to "${w.current.humidity}%",
                    "Wind" to "${w.current.windSpeed} km/h ${w.current.windDirection}",
                    "Pressure" to "${w.current.pressure.toInt()} hPa"
                )
                details.forEach { (label, value) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 1.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = value,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }
                }

                TerminalDivider()

                // Forecast
                Text(
                    text = "5-Day Forecast",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(Modifier.height(4.dp))
                w.forecast.forEach { day ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = day.date.takeLast(5),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.width(48.dp)
                        )
                        Text(
                            text = day.icon,
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            text = "${day.low.toInt()}°/${day.high.toInt()}°",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.width(64.dp)
                        )
                        Text(
                            text = day.condition,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
