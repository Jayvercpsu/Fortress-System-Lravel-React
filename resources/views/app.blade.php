<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Fortress System</title>
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="alternate icon" href="/favicon.ico">
    {{-- Fonts and icons are vendored via npm and bundled by Vite (see
        resources/js/app.jsx), so page load never depends on third-party
        CDNs or waits on them before firing load. --}}
    @viteReactRefresh
    @vite(['resources/js/app.jsx'])
    @inertiaHead
</head>

<body>
    @inertia
</body>

</html>
