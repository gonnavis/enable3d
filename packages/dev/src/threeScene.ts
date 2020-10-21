import { Project, Scene3D, PhysicsLoader, ExtendedObject3D, THREE } from 'enable3d'
import { MaterialConfig } from '../../enable3d/node_modules/@enable3d/common/dist/types'
import { SpotLight, SpotLightHelper, PointLight, DirectionalLight } from '../../threeWrapper/dist'

class MainScene extends Scene3D {
  keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
  }
  car: any
  motors: {
    leftWheel: Ammo.btHingeConstraint
    rightWheel: Ammo.btHingeConstraint
    axisLeft?: Ammo.btHingeConstraint
    axisRight?: Ammo.btHingeConstraint
  }
  light: DirectionalLight

  preload() {
    this.load.preload('grass', '/assets/grass.jpg')
  }

  addPlate() {
    const plate = this.add.box(
      { y: 1, width: 1.8, depth: 4.5, mass: 50, height: 0.25 },
      { lambert: { wireframe: true } }
    )
    this.physics.add.existing(plate)
    return plate
  }

  addAxis(z: number) {
    const axis = this.add.cylinder(
      { z, y: 1, mass: 10, radiusTop: 0.06, radiusBottom: 0.06, height: 2.575 },
      { lambert: { color: 'blue', transparent: true, opacity: 0.5 } }
    )
    axis.rotateZ(Math.PI / 2)
    this.physics.add.existing(axis)
    return axis
  }

  addRotor(x: number, z: number) {
    const rotor = this.add.cylinder(
      { mass: 10, radiusBottom: 0.35, radiusTop: 0.35, radiusSegments: 24, height: 0.4, x, y: 1, z },
      { lambert: { color: 'red', transparent: true, opacity: 0.5 } }
    )

    rotor.rotateZ(Math.PI / 2)
    this.physics.add.existing(rotor)
    return rotor
  }

  addWheel(x: number, z: number) {
    const wheel = this.add.cylinder(
      { mass: 20, radiusBottom: 0.5, radiusTop: 0.5, radiusSegments: 24, height: 0.35, x, y: 1, z },
      { lambert: { color: 'blue', transparent: true, opacity: 0.5 } }
    )

    wheel.rotateZ(Math.PI / 2)
    this.physics.add.existing(wheel)
    // wheel.body.setFriction(2)
    return wheel
  }

  async create() {
    this.warpSpeed('-ground')

    this.load.texture('grass').then(grass => {
      grass.wrapS = grass.wrapT = 1000 // RepeatWrapping
      grass.offset.set(0, 0)
      grass.repeat.set(20, 20)

      let ground = this.physics.add.ground({ width: 200, height: 200, y: 0 }, { phong: { map: grass } })
      ground.body.setFriction(1)
    })

    this.physics.debug?.enable()
    this.physics.debug?.mode(2048 + 4096)

    this.camera.position.set(0, 10, 0)
    this.camera.lookAt(0, 0, 0)

    const wheelX = 1.5,
      wheelZ = 2,
      axisZ = 0.2

    // blue wheels
    const wheelBackRight = this.addWheel(wheelX, wheelZ)
    const wheelBackLeft = this.addWheel(-wheelX, wheelZ)
    const wheelFrontRight = this.addWheel(wheelX, -wheelZ) // right front
    const wheelFrontLeft = this.addWheel(-wheelX, -wheelZ)

    // red rotors
    const rotorBackRight = this.addRotor(wheelX, wheelZ)
    const rotorBackLeft = this.addRotor(-wheelX, wheelZ)
    const rotorFrontRight = this.addRotor(wheelX, -wheelZ)
    const rotorFrontLeft = this.addRotor(-wheelX, -wheelZ)

    // blue axis
    const axisBackOne = this.addAxis(wheelZ + axisZ) // the one at the back
    const axisBackTwo = this.addAxis(wheelZ - axisZ)
    const axisFrontOne = this.addAxis(-wheelZ + axisZ)
    const axisFrontTwo = this.addAxis(-wheelZ - axisZ)

    // constraint wheel to rotor
    const wheelToRotorConstraint = { axisA: { y: 1 }, axisB: { y: 1 } }
    const motorLeft = this.physics.add.constraints.hinge(wheelBackLeft.body, rotorBackLeft.body, wheelToRotorConstraint)
    const motorRight = this.physics.add.constraints.hinge(
      wheelBackRight.body,
      rotorBackRight.body,
      wheelToRotorConstraint
    )
    this.physics.add.constraints.hinge(wheelFrontLeft.body, rotorFrontLeft.body, wheelToRotorConstraint)
    this.physics.add.constraints.hinge(wheelFrontRight.body, rotorFrontRight.body, wheelToRotorConstraint)

    // motorLeft.enableAngularMotor(true, -1, 0.05)
    // motorRight.enableAngularMotor(true, -1, 0.05)

    // constraint axis to rotor
    const axisToRotor = (rotorRight: any, rotorLeft: any, axis: any, z: number) => {
      this.physics.add.constraints.hinge(rotorRight.body, axis.body, {
        pivotA: { y: 0.2, z: z },
        pivotB: { y: -1.3 },
        axisA: { x: 1 },
        axisB: { x: 1 }
      })
      this.physics.add.constraints.hinge(rotorLeft.body, axis.body, {
        pivotA: { y: -0.2, z: z },
        pivotB: { y: 1.3 },
        axisA: { x: 1 },
        axisB: { x: 1 }
      })
    }

    axisToRotor(rotorBackRight, rotorBackLeft, axisBackOne, 0.2)
    axisToRotor(rotorBackRight, rotorBackLeft, axisBackTwo, -0.2)
    axisToRotor(rotorFrontRight, rotorFrontLeft, axisFrontOne, 0.2)
    axisToRotor(rotorFrontRight, rotorFrontLeft, axisFrontTwo, -0.2)

    const plate = this.addPlate()
    this.physics.add.constraints.lock(plate.body, axisBackOne.body)
    this.physics.add.constraints.lock(plate.body, axisBackTwo.body)
    this.physics.add.constraints.lock(plate.body, axisFrontOne.body)
    this.physics.add.constraints.lock(plate.body, axisFrontTwo.body)

    const press = (e: KeyboardEvent, isDown: boolean) => {
      e.preventDefault()
      const { code } = e
      switch (code) {
        case 'KeyW':
          this.keys.w = isDown
          break
        case 'KeyA':
          this.keys.a = isDown
          break
        case 'KeyS':
          this.keys.s = isDown
          break
        case 'KeyD':
          this.keys.d = isDown
          break
        case 'Space':
          this.keys.space = isDown
          break
      }
    }

    document.addEventListener('keydown', e => press(e, true))
    document.addEventListener('keyup', e => press(e, false))
  }

  update() {
    // this.light.position.x = this.car.body.position.x
    // this.light.position.y = this.car.body.position.y + 200
    // this.light.position.z = this.car.body.position.z + 100
    // this.light.target = this.car.body
    // this.camera.lookAt(this.car.body.position)
  }
}

const startProject = () => {
  PhysicsLoader('/lib', () => new Project({ scenes: [MainScene] }))
}

export default startProject
