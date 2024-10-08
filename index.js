import * as THREE from "https://unpkg.com/three@0.166.1/build/three.module.js";
import { TextGeometry } from "https://unpkg.com/three@0.166.1/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "https://unpkg.com/three@0.166.1/examples/jsm/loaders/FontLoader.js";


const container = document.getElementById("container");

let scene, camera, renderer, instancedMesh, center, radius;
let yzPlane, xzPlane, crossingPoint;
let gridDimensions = null;
let distances;
let crossingSphere;
let textMeshes = {};
let fontPromise;
let rowSpheresIndices = [];
let columnSpheresIndices = [];
let crossingGridCoords;
let startingYForPlane = 0;

const gradientColors = [
    { color: new THREE.Color(0x00bbff), position: 0 }, // Cyan
    { color: new THREE.Color(0xff00bb), position: 1 }, // Magenta
];

async function init() {
    const points = await loadPoints("points_cleaned.txt");
    const smoothPoints = await loadPoints("original_points_cleaned.txt");

    calculateGlobalValues(points, smoothPoints);
    setupScene();
    createGeometry(points, smoothPoints);
    adjustCamera();
    setupScrollAnimation();
}

async function loadPoints(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.text();
        return data.split("\n").map((line) => {
            const values = line.split(",").map(parseFloat);
            return new THREE.Vector3(values[0], values[1], values[2]);
        });
    } catch (error) {
        console.error(`Error loading points from ${url}:`, error);
    }
}

function calculateGlobalValues(points, smoothPoints) {

    calculateGridDimensions(points);
    distances = calculateDistances(points, smoothPoints);
    identifyGridSpheres(points, 23, 26);
}

function setupScene() {

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true, 
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(new THREE.Color(0x000000), 0); // background opacity 0
    renderer.setSize(container.offsetWidth, container.offsetHeight);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();

    container.appendChild(renderer.domElement);
    center = new THREE.Vector3();
    radius = 0;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.75);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight2.position.set(-400, -100, 80);
    scene.add(directionalLight2);

    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.8);
    scene.add(hemisphereLight);

    window.addEventListener("resize", onWindowResize, false);

    animate();
}

function createGeometry(points, smoothPoints) {

    instancedMesh = createInstancedMesh(points, smoothPoints);
    scene.add(instancedMesh);
    yzPlane = createYZPlane(points);
    xzPlane = createXZPlane(points);
    scene.add(yzPlane);
    scene.add(xzPlane);
    createCrossingSphere(crossingPoint);
    initializePlane();
}

function adjustCamera() {

    camera.position.set(center.x, center.y - radius, center.z + radius / 4);
    camera.lookAt(center);
}

function setupScrollAnimation() {

    gsap.registerPlugin(ScrollTrigger);
    const numChunks = 11;
    let currentChunk = -1;

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: container,
            start: "bottom bottom",
            end: `+=${10 * 100}%`,
            pin: true,
            fastScrollEnd: true,
            preventOverlaps: true,
            onUpdate: (self) => {
                const scrollProgress =
                    (self.progress - 1 / numChunks) / (1 - 1 / numChunks);

                let targetChunk = Math.floor(scrollProgress * (numChunks - 1));

                if (self.direction !== self.prevDirection) {
                    self.prevDirection = self.direction;
                    targetChunk = targetChunk;
                }

                if (
                    targetChunk !== currentChunk &&
                    targetChunk >= -1 &&
                    targetChunk < numChunks
                ) {
                    animateToChunk(targetChunk, self.direction);
                    currentChunk = targetChunk;
                }

            },
            onRefresh: () => {
                ScrollTrigger.clearScrollMemory();
                window.history.scrollRestoration = "manual";
            },
        },
    });

    // Create all text meshes at the start
    createText("Analysis", "analysis");
    createText("Root cause traceback", "traceback");
    createText("Correction", "correction");
    createText("Final result", "final");

    function animateToChunk(chunk, direction) {

        gsap.to(
            {},
            {
                duration: 0.7, // Adjust this duration as needed
                ease: "power3.out",
                onUpdate: function () {
                    let progress = this.progress();
                    if (direction < 0) {
                        progress = 1 - progress;
                        animateChunk(chunk + 1, progress, direction);
                    } else {
                        animateChunk(chunk, progress, direction);
                    }
                },
                onComplete: function () {
                    if (chunk === numChunks - 1 && direction > 0) {
                        completeAllAnimations();
                    }
                },
            }
        );
    }

    function animateChunk(chunk, progress) {

        switch (chunk) {
            case 0:
                animateGridAppearance(progress);
                break;
            case 1:
                animatePlaneFadeIn(progress);
                break;
            case 2:
                animatePlaneMovement(progress);
                animateTextFadeIn("analysis", progress);
                break;
            case 3:
                animatePlaneFadeOut(progress);
                animateTextFadeOut("analysis", progress);
                break;
            case 4:
                animateAllSpheresScale(progress);
                animateTextFadeIn("traceback", progress);
                break;
            case 5:
                animateSphereSegments(progress);
                break;
            case 6:
                animateCrossingSphere(progress, "rise");
                animateTextFadeOut("traceback", progress);
                animateSegmentsBack(progress);
                break;
            case 7:
                animateCrossingSphere(progress, "color");
                animateTextFadeIn("correction", progress);
                break;
            case 8:
                animateCrossingSphere(progress, "return");
                animateTextFadeOut("correction", progress);
                break;
            case 9:
                // animatePointsTransition(progress);
                transitionColor(progress);
                animateCrossingSphere(progress / 3, "fade");

                transitionScale(progress);


                transitionPosition(progress);
                animateTextFadeIn("final", progress);
                break;
            case 10:
                animateGridAppearanceBack(progress);
                animateTextFadeOut("final", progress);
                break;
        }
    }
}

// Implementation functions

function animateGridAppearance(progress) {

    const { width, length } = gridDimensions;
    const mappedY = startingYForPlane + progress * width - 20;
    xzPlane.position.set(xzPlane.position.x, mappedY, 0);
}

function animateGridAppearanceBack(progress) {

    const { width, length } = gridDimensions;
    const mappedY = startingYForPlane + width - progress * length - 20;
    xzPlane.position.set(xzPlane.position.x, mappedY, 0);
}

function createInstancedMesh(points, smoothPoints) {

    const distances = calculateDistances(points, smoothPoints);
    const sphereSizes = calculateSphereSizes(distances);
    const uniformSphereSizes = Array(10201).fill(10);
    // Create a sphere geometry with a unit radius
    const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);

    const material = new THREE.MeshStandardMaterial({
        vertexColors: false,
        metalness: 0.1,
        roughness: 0.1,
        emissive: 0x020202,
    });

    const instancedMesh = new THREE.InstancedMesh(
        sphereGeometry,
        material,
        points.length
    );
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color(0.75, 0.85, 0.95); 

    points.forEach((point, i) => {
        const size = uniformSphereSizes[i];
        matrix.makeScale(size, size, size); // Scale the sphere
        matrix.setPosition(point); // Set the position
        instancedMesh.setMatrixAt(i, matrix);
        instancedMesh.setColorAt(i, color);
        center.add(point);
    });

    center.divideScalar(points.length);
    points.forEach((point) => {
        radius = Math.max(radius, center.distanceTo(point));
    });

    instancedMesh.userData = {
        startPositions: points,
        smoothPositions: smoothPoints,
        uniformSphereSizes: uniformSphereSizes,
        sphereSizes: sphereSizes,
    };

    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;

    return instancedMesh;
}

function calculateDistances(points, smoothPoints) {

    if (points.length !== smoothPoints.length) {
        console.error(
            "The number of points and smoothPoints must be the same."
        );
        return [];
    }

    return points.map((point, i) => point.distanceTo(smoothPoints[i]));
}

function calculateSphereSizes(distances) {

    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    const minSize = 10; // Minimum sphere size
    const maxSize = 25; // Maximum sphere size

    return distances.map((distance) => {
        const t = (distance - minDistance) / (maxDistance - minDistance);
        return minSize + t * (maxSize - minSize);
    });
}

function calculateGridDimensions(points) {

    // If dimensions are already calculated, return the stored value
    if (gridDimensions) {
        return gridDimensions;
    }

    const gridSize = 101; // Assuming the grid is still 101x101

    try {
        // Calculate width (along x-axis)
        const firstRowStart = points[0];
        const firstRowEnd = points[gridSize - 1];
        const gridWidth = firstRowStart.distanceTo(firstRowEnd);

        // Calculate length (along z-axis)
        const firstColumnStart = points[0];
        const firstColumnEnd = points[(gridSize - 1) * gridSize];
        const gridLength = firstColumnStart.distanceTo(firstColumnEnd);

        // Store the calculated dimensions
        gridDimensions = { width: gridWidth, length: gridLength };
    } catch (error) {
        console.error("Error calculating grid dimensions:", error);
        // Set default values if calculation fails
        gridDimensions = { width: 5000, length: 5000 };
        console.log("Using default grid dimensions:", gridDimensions);
    }

    return gridDimensions;
}

function createYZPlane(points) {

    const { width, length } = gridDimensions;

    // Create a plane geometry
    const planeGeometry = new THREE.PlaneGeometry(width, width, 1, 32);

    // Create custom shader material
    const planeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            colorBottom: { value: new THREE.Color(gradientColors[0].color) },
            colorTop: {
                value: new THREE.Color(
                    gradientColors[gradientColors.length - 1].color
                ),
            },
            planeOpacity: { value: 0 }, // Start with opacity 0
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 colorBottom;
            uniform vec3 colorTop;
            uniform float planeOpacity;
            varying vec2 vUv;
            void main() {
                vec3 color = mix(colorTop, colorBottom, vUv.x);
                float fadeOpacity = sin(vUv.x * 3.14159) * planeOpacity;
                gl_FragColor = vec4(color, fadeOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    // Create the plane mesh
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

    // Position the plane
    planeMesh.position.set(points[0].x, center.y, center.z);
    planeMesh.rotation.y = Math.PI / 2;

    planeMesh.renderOrder = 0;

    return planeMesh;
}

function createXZPlane(points) {

    const { width, length } = gridDimensions;
    const planeGeometry = new THREE.PlaneGeometry(length, length, 1, 32);
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0,
    });
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.position.set(
        points[0].x + length / 2,
        points[100].y - 20,
        center.z
    );
    planeMesh.rotation.x = Math.PI / 2;
    startingYForPlane = points[100].y;
    return planeMesh;
}

function animate() {

    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    if (instancedMesh) {
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.instanceColor.needsUpdate = true;
    }
    if (yzPlane) yzPlane.position.needsUpdate = true;
    if (crossingSphere) crossingSphere.material.needsUpdate = true;
}

function identifyGridSpheres(points, rowIndex, columnIndex) {

    const gridSize = 101;
    const crossingPointIndex = rowIndex * gridSize + columnIndex;
    crossingPoint = points[crossingPointIndex].clone();

    // Store grid coordinates separately
    crossingGridCoords = new THREE.Vector2(columnIndex, rowIndex);

    // Identify row spheres
    rowSpheresIndices = Array.from(
        { length: gridSize },
        (_, i) => rowIndex * gridSize + i
    );

    // Identify column spheres
    columnSpheresIndices = Array.from(
        { length: gridSize },
        (_, i) => i * gridSize + columnIndex
    );
}

function createCrossingSphere() {

    const baseGeometry = new THREE.IcosahedronGeometry(65, 0); // radius 100, detail 0
    const detailedGeometry = new THREE.IcosahedronGeometry(65, 2); // radius 100, detail 2
    const material = new THREE.MeshStandardMaterial({
        color: 0xff0000, // Start with red
        metalness: 0.5,
        roughness: 0.2,
        flatShading: true,
        transparent: true,
        opacity: 0,
    });
    crossingSphere = new THREE.Mesh(baseGeometry, material);

    // Use the actual 3D coordinates for the crossing point
    crossingSphere.position.copy(crossingPoint);

    crossingSphere.scale.set(1, 1, 1);
    crossingSphere.material.opacity = 0; // Start with zero scale
    // Start with zero scale
    crossingSphere.userData = {
        baseGeometry: baseGeometry,
        detailedGeometry: detailedGeometry,
    };
    scene.add(crossingSphere);
}

async function createText(text, identifier) {

    if (!fontPromise) {
        const loader = new FontLoader();
        fontPromise = new Promise((resolve, reject) => {
            loader.load(
                "https://components.ai/api/v1/typefaces/rubik/normal/600",
                resolve,
                undefined,
                reject
            );
        });
    }

    const font = await fontPromise;

    const textGeometry = new TextGeometry(text, {
        font: font,
        size: 100,
        depth: 5,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 1,
        bevelOffset: 0,
        bevelSegments: 1,
        align: "left",
    });

    const textMaterial = new THREE.MeshPhongMaterial({
        color: 0x777777,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
    });

    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textGeometry.computeBoundingBox();
    const textWidth =
        textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
    textMesh.position.set(center.x, center.y, center.z + 1500);
    textMesh.rotation.x = Math.PI / 2;
    scene.add(textMesh);

    textMeshes[identifier] = textMesh;
}

function animatePlaneFadeIn(progress) {

    if (!yzPlane) {
        console.log("YZ Plane not initialized");
        return;
    }

    const opacity = Math.min(progress * 1, 0.5); // Fade in during the first half of the chunk
    yzPlane.material.uniforms.planeOpacity.value = opacity;

    // Ensure the plane is in its starting position
    const { startPositions } = instancedMesh.userData;
    yzPlane.position.setX(startPositions[0].x - 5);
    yzPlane.updateMatrix();
}

function animatePlaneMovement(progress) {

    if (!yzPlane) {
        console.log("YZ Plane not initialized");
        return;
    }

    const { width, length } = gridDimensions;
    const { startPositions } = instancedMesh.userData;
    const startX = startPositions[0].x - 5;
    const endX = startX + length;

    const newX = lerp(startX, endX, progress);

    yzPlane.position.setX(newX);
    yzPlane.updateMatrix();

    updatePointColors(newX);
}

function updatePointColors(planePosition) {

    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    const { startPositions } = instancedMesh.userData;

    for (let i = 0; i < instancedMesh.count; i++) {
        if (startPositions[i].x <= planePosition) {
            const color = mapDistanceToCustomGradient(
                distances[i],
                minDistance,
                maxDistance
            );
            instancedMesh.setColorAt(i, color);
        } else {
            instancedMesh.setColorAt(i, new THREE.Color(0.75, 0.85, 0.95)); // White for spheres not yet reached
        }
    }

    instancedMesh.instanceColor.needsUpdate = true;

    // Log the first few colors after update for debugging
    for (let i = 0; i < 5; i++) {
        const color = new THREE.Color();
        instancedMesh.getColorAt(i, color);
    }
}

function mapDistanceToCustomGradient(distance, minDistance, maxDistance) {

    const t = (distance - minDistance) / (maxDistance - minDistance);

    // Find the two colors to interpolate between
    let colorA, colorB, positionA, positionB;
    for (let i = 0; i < gradientColors.length - 1; i++) {
        if (
            t >= gradientColors[i].position &&
            t <= gradientColors[i + 1].position
        ) {
            colorA = gradientColors[i].color;
            colorB = gradientColors[i + 1].color;
            positionA = gradientColors[i].position;
            positionB = gradientColors[i + 1].position;
            break;
        }
    }

    // If t is exactly 1 or we didn't find a segment (shouldn't happen with proper gradient definition)
    if (t === 1 || !colorA) {
        return gradientColors[gradientColors.length - 1].color;
    }

    // Interpolate between the two colors
    const segmentT = (t - positionA) / (positionB - positionA);
    return lerpColor(colorA, colorB, segmentT);
}

function animatePlaneFadeOut(progress) {

    if (!yzPlane) {
        console.log("YZ Plane not initialized");
        return;
    }

    const opacity = 0.5 - Math.min(progress * 1, 0.5); // Fade out during the first half of the chunk
    yzPlane.material.uniforms.planeOpacity.value = opacity;

    // Keep the plane in its end position
    const { width, length } = gridDimensions;
    const { startPositions } = instancedMesh.userData;
    const endX = startPositions[0].x + length;
    yzPlane.position.setX(endX);
    yzPlane.updateMatrix();
}

function animateTextFadeIn(identifier, progress) {

    if (textMeshes[identifier]) {
        textMeshes[identifier].material.opacity = Math.min(progress * 2, 1);
    }
}

function animateTextFadeOut(identifier, progress) {

    if (textMeshes[identifier]) {
        // Ensure the opacity goes all the way to 0
        textMeshes[identifier].material.opacity = Math.max(0, 1 - progress);
    }
}

function animateSphereSegments(progress) {

    const totalSpheres = 101;
    const matrix = new THREE.Matrix4();
    const maxScaleFactor = 2.5; // Adjust this value to change the maximum scale

    function scaleSphereSegment(indices, maxSpheres, reverse = false) {

        const spheresToScale = Math.ceil(lerp(0, maxSpheres, progress));

        indices.forEach((index, i) => {
            const sphereIndex = reverse ? maxSpheres - 1 - i : i;
            instancedMesh.getMatrixAt(index, matrix);
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, quaternion, scale);

            const baseSize = instancedMesh.userData.sphereSizes[index];

            if (sphereIndex < spheresToScale) {
                // Calculate local progress so that it increases as we approach the crossing point
                const localProgress = reverse
                    ? 1 - (spheresToScale - sphereIndex) / spheresToScale
                    : sphereIndex / spheresToScale;

                const scaleFactor = lerp(1, maxScaleFactor, localProgress);
                const newSize = baseSize * scaleFactor;
                scale.set(newSize, newSize, newSize);
            } else {
                scale.set(baseSize, baseSize, baseSize);
            }

            matrix.compose(position, quaternion, scale);
            instancedMesh.setMatrixAt(index, matrix);
        });
    }

    // Use grid coordinates for animation
    const rowCrossingIndex = crossingGridCoords.x;
    const columnCrossingIndex = crossingGridCoords.y;

    // Animate row spheres
    scaleSphereSegment(
        rowSpheresIndices.slice(0, rowCrossingIndex + 1),
        rowCrossingIndex + 1
    );
    scaleSphereSegment(
        rowSpheresIndices.slice(rowCrossingIndex),
        totalSpheres - rowCrossingIndex,
        true
    );

    // Animate column spheres
    scaleSphereSegment(
        columnSpheresIndices.slice(0, columnCrossingIndex + 1),
        columnCrossingIndex + 1
    );
    scaleSphereSegment(
        columnSpheresIndices.slice(columnCrossingIndex),
        totalSpheres - columnCrossingIndex,
        true
    );

    instancedMesh.instanceMatrix.needsUpdate = true;
}

function animateAllSpheresScale(progress) {

    const matrix = new THREE.Matrix4();

    for (let i = 0; i < instancedMesh.count; i++) {
        instancedMesh.getMatrixAt(i, matrix);
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(position, quaternion, scale);

        const initialSize = instancedMesh.userData.uniformSphereSizes[i];
        const finalSize = instancedMesh.userData.sphereSizes[i];
        const newSize = lerp(initialSize, finalSize, progress);

        scale.set(newSize, newSize, newSize);
        matrix.compose(position, quaternion, scale);
        instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
}

function animateSegmentsBack(progress) {

    const matrix = new THREE.Matrix4();

    // Initialize previousSizes if it doesn't exist
    if (!instancedMesh.userData.previousSizes) {
        instancedMesh.userData.previousSizes = new Array(
            instancedMesh.count
        ).fill(null);
    }

    function resetSegmentScale(indices) {

        indices.forEach((index) => {
            instancedMesh.getMatrixAt(index, matrix);
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(position, quaternion, scale);

            const baseSize = instancedMesh.userData.sphereSizes[index];

            // Use the stored previous size or current size, whichever is larger
            if (instancedMesh.userData.previousSizes[index] === null) {
                instancedMesh.userData.previousSizes[index] = scale.x;
            } else {
                instancedMesh.userData.previousSizes[index] = Math.max(
                    instancedMesh.userData.previousSizes[index],
                    scale.x
                );
            }

            const maxSize = instancedMesh.userData.previousSizes[index];

            // Interpolate from max size to base size
            const newSize = lerp(maxSize, baseSize, progress);

            scale.set(newSize, newSize, newSize);
            matrix.compose(position, quaternion, scale);
            instancedMesh.setMatrixAt(index, matrix);
        });
    }

    // Reset row spheres
    resetSegmentScale(rowSpheresIndices);

    // Reset column spheres
    resetSegmentScale(columnSpheresIndices);

    instancedMesh.instanceMatrix.needsUpdate = true;
}

function animateCrossingSphere(progress, phase) {
    
    if (!crossingSphere) {
        createCrossingSphere();
    }

    const maxSize = 1;
    const maxHeight = 1000;
    const maxRotation = Math.PI * 4;

    switch (phase) {
        case "rise":
            // Rising and growing
            const size = (progress + 0.5) * maxSize;
            const opacity = progress;
            crossingSphere.scale.set(size, size, size);
            crossingSphere.position.z = crossingPoint.z + progress * maxHeight;
            crossingSphere.rotation.z = progress * maxRotation;
            crossingSphere.material.opacity = opacity;
            crossingSphere.material.color.setRGB(1, 0, 0); // Start with red

            // Ensure we're using the base geometry during the rise phase
            if (
                crossingSphere.geometry !== crossingSphere.userData.baseGeometry
            ) {
                crossingSphere.geometry = crossingSphere.userData.baseGeometry;
            }
            break;

        case "color":
            // Color transition at the top
            const color = new THREE.Color(1, 0, 0).lerp(
                new THREE.Color(0, 0.68, 1),
                progress
            );
            crossingSphere.material.color.copy(color);
            // Switch to detailed geometry
            if (
                progress > 0.5 &&
                crossingSphere.geometry !==
                    crossingSphere.userData.detailedGeometry
            ) {
                crossingSphere.geometry =
                    crossingSphere.userData.detailedGeometry;
            } else if (
                progress <= 0.5 &&
                crossingSphere.geometry !== crossingSphere.userData.baseGeometry
            ) {
                crossingSphere.geometry = crossingSphere.userData.baseGeometry;
            }
            // Continue rotating
            crossingSphere.rotation.z += 0.05; // Adjust rotation speed as needed
            break;

        case "return":
            // Returning to original position
            const returnSize = maxSize * (1.5 - progress);
            crossingSphere.scale.set(returnSize, returnSize, returnSize);
            crossingSphere.position.z =
                crossingPoint.z + maxHeight * (1 - progress);
            crossingSphere.rotation.z += 0.05; // Continue rotating
            break;

        case "fade":
            // Fading out during points transition
            crossingSphere.material.opacity = 1 - progress * 2;
            crossingSphere.material.transparent = true;
            break;
    }
}

function transitionColor(progress) {

    const { startPositions, smoothPositions } = instancedMesh.userData;
    const maxDistance = Math.max(...distances);

    // Calculate distances from crossing point for staggered animation
    const distancesFromCrossing = startPositions.map((pos) =>
        pos.distanceTo(crossingPoint)
    );
    const maxDistanceFromCrossing = Math.max(...distancesFromCrossing);

    for (let i = 0; i < instancedMesh.count; i++) {
        const startPos = startPositions[i];
        const smoothPos = smoothPositions[i];
        const pointDistance = startPos.distanceTo(smoothPos);

        // Calculate start and end times for each sphere
        const distanceRatio =
            distancesFromCrossing[i] / maxDistanceFromCrossing;
        const startTime = distanceRatio * 1; // Adjust this multiplier to control stagger amount
        const endTime = 1 - (1 - distanceRatio) * 0.75; // Adjust this to control end time stagger

        // Calculate local progress for this sphere
        let localProgress;
        if (progress < startTime) {
            localProgress = 0;
        } else if (progress > endTime) {
            localProgress = 1;
        } else {
            localProgress = (progress - startTime) / (endTime - startTime);
        }

        const colorProgress = pointDistance / maxDistance;
        const startColor = lerpColor(
            gradientColors[0].color,
            gradientColors[1].color,
            colorProgress
        );
        const endColor = new THREE.Color(0x00bbff);
        const finalColor = lerpColor(startColor, endColor, localProgress);

        instancedMesh.setColorAt(i, finalColor);
    }

    instancedMesh.instanceColor.needsUpdate = true;
}

function transitionScale(progress) {

    const { sphereSizes, startPositions } = instancedMesh.userData;
    const minSize = 10; // Minimum sphere size
    const matrix = new THREE.Matrix4();

    // Calculate distances from crossing point for staggered animation
    const distancesFromCrossing = startPositions.map((pos) =>
        pos.distanceTo(crossingPoint)
    );
    const maxDistanceFromCrossing = Math.max(...distancesFromCrossing);

    for (let i = 0; i < instancedMesh.count; i++) {
        instancedMesh.getMatrixAt(i, matrix);
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(position, quaternion, scale);

        // Calculate start and end times for each sphere
        const distanceRatio =
            distancesFromCrossing[i] / maxDistanceFromCrossing;
        const startTime = distanceRatio * 1; // Adjust this multiplier to control stagger amount
        const endTime = 1 - (1 - distanceRatio) * 0.75; // Adjust this to control end time stagger

        // Calculate local progress for this sphere
        let localProgress;
        if (progress < startTime) {
            localProgress = 0;
        } else if (progress > endTime) {
            localProgress = 1;
        } else {
            localProgress = (progress - startTime) / (endTime - startTime);
        }

        const initialSize = sphereSizes[i];
        const newSize = lerp(initialSize, minSize, localProgress);

        scale.set(newSize, newSize, newSize);
        matrix.compose(position, quaternion, scale);
        instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
}

function transitionPosition(progress) {

    const { startPositions, smoothPositions } = instancedMesh.userData;
    const matrix = new THREE.Matrix4();

    // Calculate distances from crossing point for staggered animation
    const distancesFromCrossing = startPositions.map((pos) =>
        pos.distanceTo(crossingPoint)
    );
    const maxDistanceFromCrossing = Math.max(...distancesFromCrossing);

    for (let i = 0; i < instancedMesh.count; i++) {
        const startPos = startPositions[i];
        const smoothPos = smoothPositions[i];

        // Calculate start and end times for each sphere
        const distanceRatio =
            distancesFromCrossing[i] / maxDistanceFromCrossing;
        const startTime = distanceRatio * 1; // Adjust this multiplier to control stagger amount
        const endTime = 1 - (1 - distanceRatio) * 0.75; // Adjust this to control end time stagger

        // Calculate local progress for this sphere
        let localProgress;
        if (progress < startTime) {
            localProgress = 0;
        } else if (progress > endTime) {
            localProgress = 1;
        } else {
            localProgress = (progress - startTime) / (endTime - startTime);
        }

        const newPos = new THREE.Vector3().lerpVectors(
            startPos,
            smoothPos,
            localProgress
        );

        instancedMesh.getMatrixAt(i, matrix);
        matrix.setPosition(newPos);
        instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
}

function completeAllAnimations() {

    Object.values(textMeshes).forEach((mesh) => {
        mesh.material.opacity = 0;
    });
}

function initializePlane() {

    if (yzPlane) {
        yzPlane.material.uniforms.planeOpacity.value = 0;
        yzPlane.material.needsUpdate = true;
    }
}

function lerpColor(colorA, colorB, t) {

    return new THREE.Color(
        colorA.r + (colorB.r - colorA.r) * t,
        colorA.g + (colorB.g - colorA.g) * t,
        colorA.b + (colorB.b - colorA.b) * t
    );
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function lerp(start, end, t) {
    
    return start * (1 - t) + end * t;
}

init();
