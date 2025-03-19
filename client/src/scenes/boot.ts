import Phaser from 'phaser';

export class Boot extends Phaser.Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
        //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

        this.load.image('logo', 'assets/logo.png');
        this.load.image('loading-bar', 'assets/loading-bar.png');
        this.load.image('loading-bar-bg', 'assets/loading-bar-bg.png');
    }

    create ()
    {
        this.scale.setGameSize(1280, 720);
        
        this.scene.start('Preload');
    }
}
