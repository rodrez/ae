import Phaser from 'phaser';
import { AuthService } from '../services/auth-service';
import { Button, Input, Link } from '../ui/elements';

export class MainMenu extends Phaser.Scene
{
    private authService: AuthService;
    private loginButton!: Button;
    private registerLink!: Link;
    private usernameInput!: Input;
    private emailInput!: Input;
    private passwordInput!: Input;
    private loginMode: boolean = true;
    private uiElements: Array<Button | Input | Link> = [];

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
        this.clearUIElements();
        
        // Create input fields
        if (!this.loginMode) {
            this.usernameInput = new Input({
                type: 'text',
                placeholder: 'Username',
                x: 640,
                y: 350,
                width: '300px',
                marginBottom: '10px'
            });
            this.uiElements.push(this.usernameInput);
        }
        
        this.emailInput = new Input({
            type: 'email',
            placeholder: 'Email',
            x: 640,
            y: this.loginMode ? 350 : 400,
            width: '300px',
            marginBottom: '10px'
        });
        this.uiElements.push(this.emailInput);
        
        this.passwordInput = new Input({
            type: 'password',
            placeholder: 'Password',
            x: 640,
            y: this.loginMode ? 400 : 450,
            width: '300px'
        });
        this.uiElements.push(this.passwordInput);
        
        // Create button
        this.loginButton = new Button(
            this.loginMode ? 'Login' : 'Register', 
            {
                x: 640,
                y: this.loginMode ? 470 : 520,
                width: '300px',
                onClick: () => this.loginMode ? this.handleLogin() : this.handleRegister()
            }
        );
        this.uiElements.push(this.loginButton);
        
        // Create register/login link
        this.registerLink = new Link(
            this.loginMode ? 'Don\'t have an account? Register' : 'Already have an account? Login',
            {
                x: 640,
                y: this.loginMode ? 520 : 570,
                fontSize: '16px',
                onClick: () => this.toggleAuthMode()
            }
        );
        this.uiElements.push(this.registerLink);
    }

    private clearUIElements() {
        this.uiElements.forEach(element => element.destroy());
        this.uiElements = [];
    }

    private toggleAuthMode() {
        this.loginMode = !this.loginMode;
        this.createAuthUI();
    }

    private async handleLogin() {
        try {
            const email = this.emailInput.getValue().trim();
            const password = this.passwordInput.getValue();
            
            console.log('Login form submitted with values:', { 
                email,
                passwordLength: password ? password.length : 0 
            });
            
            if (!email) {
                console.error('Login validation failed - missing email');
                alert('Please enter your email address');
                return;
            }
            
            if (!password) {
                console.error('Login validation failed - missing password');
                alert('Please enter your password');
                return;
            }
            
            this.loginButton.disable();
            
            const result = await this.authService.login(email, password);
            
            if (result.token) {
                console.log('Login successful, storing token and redirecting');
                localStorage.setItem('token', result.token);
                localStorage.setItem('userId', result.user.id.toString());
                
                this.clearUIElements();
                
                this.scene.start('Game');
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed. Please check your credentials.');
            this.loginButton.enable();
        }
    }

    private async handleRegister() {
        try {
            const username = this.usernameInput.getValue().trim();
            const email = this.emailInput.getValue().trim();
            const password = this.passwordInput.getValue();
            
            console.log('Registration form submitted with values:', { 
                username, 
                email,
                passwordLength: password ? password.length : 0 
            });
            
            if (!username) {
                console.error('Registration validation failed - missing username');
                alert('Please enter a username');
                return;
            }
            
            if (!email) {
                console.error('Registration validation failed - missing email');
                alert('Please enter your email address');
                return;
            }
            
            if (!password) {
                console.error('Registration validation failed - missing password');
                alert('Please enter a password');
                return;
            }
            
            if (password.length < 8) {
                console.error('Registration validation failed - password too short');
                alert('Password must be at least 8 characters long');
                return;
            }
            
            this.loginButton.disable();
            
            const result = await this.authService.register(
                username,
                email,
                password
            );
            
            if (result.token) {
                console.log('Registration successful, storing token and redirecting');
                localStorage.setItem('token', result.token);
                localStorage.setItem('userId', result.user.id.toString());
                
                this.clearUIElements();
                
                this.scene.start('Game');
            }
        } catch (error) {
            console.error('Registration failed:', error);
            alert('Registration failed. Please try again with different credentials.');
            this.loginButton.enable();
        }
    }
    
    shutdown() {
        this.clearUIElements();
    }
}
