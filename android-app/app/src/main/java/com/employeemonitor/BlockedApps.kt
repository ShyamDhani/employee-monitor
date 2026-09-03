package com.employeemonitor

object BlockedApps {

    val blockedPackages = setOf(
        "com.instagram.android",
        "com.facebook.katana",
        "com.facebook.orca",
        "com.twitter.android",
        "com.google.android.youtube",
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill",
        "com.snapchat.android",
        "com.pinterest",
        "com.reddit.frontpage",
        "com.linkedin.android",
        "com.kwai.video",
        "com.vimeo.android.videoapp",
        "com.twitch.android.app",
        "com.dailymotion.dailymotion",
        "com.netflix.mediaclient",
        "com.disney.disneyplus",
        "com.hbo.hbonow",
        "com.amazon.avod.thirdpartyclient",
        "com.crunchyroll.crunchyroid",
        "tv.twitch.android.app",
        "com.spotify.music",
        "com.apple.android.music",
        "com.soundcloud.android",
        "com.shazam.android",
        "com.tiktok.ugc",
        "com.kuaishou.nebula",
        "com.sina.weibo",
        "com.anscamobile.mimicry",
        "com.ebay.mobile",
        "com.amazon.mShop.android.shopping",
        "com.flipkart.android"
    )

    fun isBlocked(packageName: String): Boolean {
        return blockedPackages.contains(packageName.lowercase())
    }

    fun getAppDisplayName(packageName: String): String {
        return when (packageName) {
            "com.instagram.android" -> "Instagram"
            "com.facebook.katana" -> "Facebook"
            "com.facebook.orca" -> "Messenger"
            "com.twitter.android" -> "Twitter / X"
            "com.google.android.youtube" -> "YouTube"
            "com.zhiliaoapp.musically" -> "TikTok"
            "com.ss.android.ugc.trill" -> "TikTok"
            "com.snapchat.android" -> "Snapchat"
            "com.pinterest" -> "Pinterest"
            "com.reddit.frontpage" -> "Reddit"
            "com.linkedin.android" -> "LinkedIn"
            "com.kwai.video" -> "Kwai"
            "com.netflix.mediaclient" -> "Netflix"
            "com.spotify.music" -> "Spotify"
            "com.disney.disneyplus" -> "Disney+"
            "com.amazon.mShop.android.shopping" -> "Amazon Shopping"
            "com.flipkart.android" -> "Flipkart"
            else -> packageName.substringAfterLast('.')
        }
    }
}
