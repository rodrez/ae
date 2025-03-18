import Phaser from 'phaser';
import { GameConfig } from '../config';
import { AuthService } from '../services/AuthService';

export class MainMenu extends Phaser.Scene
{
    private authService: AuthService;
    private loginButton!: Phaser.GameObjects.Image;
    private registerButton!: Phaser.GameObjects.Image;
    private usernameInput!: HTMLInputElement;
    private emailInput!: HTMLInputElement;
    private passwordInput!: HTMLInputElement;
    private loginMode: boolean = true;
    private inputsContainer!: HTMLDivElement;

    constructor ()
    {
        super('MainMenu');
        this.authService = new AuthService();
    }

    create ()
    {
        this.add.image(640, 360, 'world-bg').setScale(0.5);

        this.add.image(640, 200, 'logo');

        this.createAuthUI();
    }

    private createAuthUI() {
        this.removeHTMLInputs();
        
        this.createHTMLInputs();
        
        this.loginButton = this.add.image(640, 500, 'button')
            .setInteractive()
            .on('pointerdown', () => this.handleLogin());
        
        this.add.text(640, 500, 'Login', {
            color: '#ffffff',
            fontSize: '24px'
        }).setOrigin(0.5);
        
        const registerText = this.add.text(640, 560, 'Don\'t have an account? Register', {
            color: '#ffffff',
            fontSize: '18px'
        }).setOrigin(0.5).setInteractive()
            .on('pointerdown', () => this.toggleAuthMode());
    }

    private createHTMLInputs() {
        this.inputsContainer = document.createElement('div');
        this.inputsContainer.style.position = 'absolute';
        this.inputsContainer.style.left = '50%';
        this.inputsContainer.style.top = '50%';
        this.inputsContainer.style.transform = 'translate(-50%, -50%)';
        this.inputsContainer.style.width = '300px';
        
        if (!this.loginMode) {
            this.usernameInput = document.createElement('input');
            this.usernameInput.type = 'text';
            this.usernameInput.placeholder = 'Username';
            this.usernameInput.style.padding = '10px';
            this.usernameInput.style.marginBottom = '10px';
            this.usernameInput.style.width = '100%';
            this.usernameInput.style.boxSizing = 'border-box';
            this.inputsContainer.appendChild(this.usernameInput);
        }
        
        this.emailInput = document.createElement('input');
        this.emailInput.type = 'email';
        this.emailInput.placeholder = 'Email';
        this.emailInput.style.padding = '10px';
        this.emailInput.style.marginBottom = '10px';
        this.emailInput.style.width = '100%';
        this.emailInput.style.boxSizing = 'border-box';
        this.inputsContainer.appendChild(this.emailInput);
        
        this.passwordInput = document.createElement('input');
        this.passwordInput.type = 'password';
        this.passwordInput.placeholder = 'Password';
        this.passwordInput.style.padding = '10px';
        this.passwordInput.style.width = '100%';
        this.passwordInput.style.boxSizing = 'border-box';
        this.inputsContainer.appendChild(this.passwordInput);
        
        document.body.appendChild(this.inputsContainer);
    }

    private removeHTMLInputs() {
        const existingInputs = document.querySelectorAll('input');
        existingInputs.forEach(input => {
            if (input.parentNode && input.parentNode !== document.body) {
                document.body.removeChild(input.parentNode);
            } else if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        });
    }

    private toggleAuthMode() {
        this.loginMode = !this.loginMode;
        
        this.removeHTMLInputs();
        
        this.createHTMLInputs();
        
        const buttonText = this.loginMode ? 'Login' : 'Register';
        this.loginButton.removeListener('pointerdown');
        this.loginButton.on('pointerdown', () => this.loginMode ? this.handleLogin() : this.handleRegister());
        
        this.children.list.forEach(child => {
            if (child instanceof Phaser.GameObjects.Text && 
                (child.text === 'Login' || child.text === 'Register')) {
                child.setText(buttonText);
            }
            if (child instanceof Phaser.GameObjects.Text && 
                (child.text === 'Don\'t have an account? Register' || 
                 child.text === 'Already have an account? Login')) {
                child.setText(this.loginMode ? 
                    'Don\'t have an account? Register' : 
                    'Already have an account? Login');
            }
        });
    }

    private async handleLogin() {
        try {
            const result = await this.authService.login(
                this.emailInput.value,
                this.passwordInput.value
            );
            
            if (result.token) {
                localStorage.setItem('token', result.token);
                localStorage.setItem('userId', result.user.id.toString());
                
                this.removeHTMLInputs();
                
                this.scene.start('Game');
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed. Please check your credentials.');
        }
    }

    private async handleRegister() {
        try {
            const result = await this.authService.register(
                this.usernameInput.value,
                this.emailInput.value,
                this.passwordInput.value
            );
            
            if (result.token) {
                localStorage.setItem('token', result.token);
                localStorage.setItem('userId', result.user.id.toString());
                
                this.removeHTMLInputs();
                
                this.scene.start('Game');
            }
        } catch (error) {
            console.error('Registration failed:', error);
            alert('Registration failed. Please try again with different credentials.');
        }
    }
}
