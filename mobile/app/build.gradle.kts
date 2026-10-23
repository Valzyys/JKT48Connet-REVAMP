plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Alamat situs JKT48Connect (worker yang melayani /api/app/*).
// Atur saat build: ./gradlew assembleRelease -PapiBase=https://domain-kamu  (atau env API_BASE).
val apiBase: String = (findProperty("apiBase") as String?)
    ?: System.getenv("API_BASE")?.takeIf { it.isNotBlank() }
    ?: "https://jkt48connect.app"

// Kunci rilis tetap (dari GitHub Secrets di workflow rilis) supaya APK baru bisa memperbarui yang lama
// tanpa hapus-pasang. Tanpa SIGNING_STORE_FILE dipakai kunci debug (hanya untuk dicoba).
val releaseKeystore: File? = System.getenv("SIGNING_STORE_FILE")?.takeIf { it.isNotBlank() }?.let(::file)?.takeIf { it.exists() }

android {
    namespace = "app.jkt48connect"
    compileSdk = 37

    defaultConfig {
        applicationId = "app.jkt48connect"
        minSdk = 26
        targetSdk = 36
        versionCode = 7
        versionName = "2.2.3"
        buildConfigField("String", "API_BASE", "\"${apiBase.trimEnd('/')}\"")
        androidResources.localeFilters += listOf("in", "en")
    }

    signingConfigs {
        if (releaseKeystore != null) create("release") {
            val env = { name: String -> System.getenv(name)?.takeIf { it.isNotBlank() } }
            storeFile = releaseKeystore
            storePassword = env("SIGNING_STORE_PASSWORD")
            // Alias & password kunci opsional: bawaan scripts/buat-keystore.sh (alias jkt48connect, password sama).
            keyAlias = env("SIGNING_KEY_ALIAS") ?: "jkt48connect"
            keyPassword = env("SIGNING_KEY_PASSWORD") ?: storePassword
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName(if (releaseKeystore != null) "release" else "debug")
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
    // Server push (FCM). Dikonfigurasi saat runtime dari worker, jadi tanpa plugin google-services.
    implementation("com.google.firebase:firebase-messaging:25.1.3")
}
