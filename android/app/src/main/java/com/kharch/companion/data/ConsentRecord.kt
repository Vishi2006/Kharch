package com.kharch.companion.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "consent_record")
data class ConsentRecord(
    @PrimaryKey
    val id: Int = 1,
    val grantedAt: Long,
    val allowedPackages: List<String>,
    val version: String
)
