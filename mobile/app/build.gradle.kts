plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Alamat situs JKT48Connect (worker yang melayani /api/app/*).
// Atur saat build: ./gradlew assembleRelease -PapiBase=https://domain-kamu  (atau env API_BASE).
val apiBase: String = (findProperty("apiBase") as String?)
    ?: System.getenv("API_BASE")?.takeIf { it.isNotBlank() }
    ?: "https://jkt48connect.app"

android {
    namespace = "app.jkt48connect"
    compileSdk = 37

    defaultConfig {
        applicationId = "app.jkt48connect"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "2.0.0"
        buildConfigField("String", "API_BASE", "\"${apiBase.trimEnd('/')}\"")
        androidResources.localeFilters += listOf("in", "en")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Belum ada keystore rilis: APK ditandatangani kunci debug (hanya untuk dicoba).
            signingConfig = signingConfigs.getByName("debug")
            vcsInfo.include = false
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources {
            excludes += listOf(
                "DebugProbesKt.bin",
                "kotlin-tooling-metadata.json",
                "kotlin/**",
                "META-INF/*.version",
                "META-INF/**/LICENSE.txt",
            )
        }
    }
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }
    lint {
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("io.github.kyant0:backdrop:2.0.1")
    implementation("io.github.kyant0:shapes:1.2.1")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.foundation:foundation:1.12.0")
    implementation("androidx.compose.ui:ui:1.12.0")
    implementation("androidx.compose.material:material-icons-extended:1.7.8")
    implementation("androidx.media3:media3-exoplayer:1.9.2")
    implementation("androidx.media3:media3-exoplayer-hls:1.9.2")
}
