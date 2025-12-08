<template>
    <nav class="navbar">
        <router-link to="/" class="links">Counter</router-link>
        <router-link to="/data" class="links">Data</router-link>
        <router-link to="/form" class="links">Form</router-link>
        <router-link to="/pie" class="links">PieChart</router-link>
        <router-link to="/levenshtein" class="links">Levenshtein</router-link>
        <router-link to="/jsoneditor" class="links">JsonEditor</router-link>
    </nav>
</template>

<script>
import './navbar.css';
</script>