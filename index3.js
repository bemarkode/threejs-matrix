import * as THREE from 'https://unpkg.com/three@0.112/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.112/examples/jsm/controls/OrbitControls.js';

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
var controls = new OrbitControls(camera, renderer.domElement);
document.body.appendChild(renderer.domElement);
camera.position.z = 5;

var points = [];
var geometry = new THREE.BufferGeometry();
var material = new THREE.PointsMaterial({ size: 0.04, color: 0x00ffff });
var pointsObject = new THREE.Points(geometry, material);

async function loadPoints(file) {
    var loader = new THREE.FileLoader();
    loader.load(file, function(text) {
        var lines = text.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line === '') {
                continue;
            }
            var coords = line.replace(/{/g, '[').replace(/}/g, ']').replace(/;/g,',');
            var scaledCoords = JSON.parse(coords).map(c => c * 0.01);
            var x = parseFloat(scaledCoords[0]);
            var y = parseFloat(scaledCoords[1]);
            var z = parseFloat(scaledCoords[2]);
            points.push(new THREE.Vector3(x, y, z));
        }
        init();
        
    });
    
    
}



loadPoints('points.txt').then(() => {
    
});
async function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
async function init() {
    geometry.setFromPoints(points);

    var grid = await separatePoints(points, 101)
    scene.add(pointsObject);
    console.log(grid);
    createLines([grid[23]], 1);
    animate();
}

async function separatePoints(points, gridSize) {
    var array2D = new Array(gridSize);
    for (var i = 0; i < gridSize; i++) {
        array2D[i] = new Array();
    }
    for (var i = 0; i < points.length; i++) {
        var point = points[i];
        var row = Math.floor(i / gridSize);
        array2D[row].push(point);
    }
    return array2D;
}

async function createLines(grid, gridSize) {
    for (var i = 0; i < gridSize; i++) {
        var rowPoints = grid[i];
        if (rowPoints.length > 1) {
            var geometry = new THREE.BufferGeometry();
            var material = new THREE.LineBasicMaterial({ color: 0x00ffff });
            var line = new THREE.Line(geometry, material);
            var positions = rowPoints.map(p => p);
            geometry.setFromPoints(positions);
            scene.add(line);
        }
    }
}

