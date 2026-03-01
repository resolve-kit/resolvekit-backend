from knowledge_bases.services.crawling import _extract_image_candidates_from_html


def test_extract_image_candidates_includes_cdn_images_with_context() -> None:
    html = """
    <html>
      <body>
        <main>
          <h2>Reset password</h2>
          <p>Open Settings and tap Account.</p>
          <img src="https://images.ctfassets.net/tutorials/reset-step-1.png" alt="Settings account screen" width="1280" height="720" />
          <p>Then tap Reset Password.</p>
          <img src="/assets/tutorial/step-2.png" alt="Reset password button" />
        </main>
      </body>
    </html>
    """
    images = _extract_image_candidates_from_html("https://docs.example.com/help/reset-password", html)

    assert len(images) == 2
    assert images[0].url == "https://images.ctfassets.net/tutorials/reset-step-1.png"
    assert images[0].section_heading == "Reset password"
    assert "Open Settings" in (images[0].context_text or "")
    assert images[1].url == "https://docs.example.com/assets/tutorial/step-2.png"


def test_extract_image_candidates_marks_navigation_chrome_images() -> None:
    html = """
    <html>
      <body>
        <header>
          <img src="/logo.png" alt="Acme logo" class="site-logo icon" width="24" height="24" />
        </header>
        <main>
          <h2>Pair a new device</h2>
          <p>Tap Devices, then Add Device.</p>
          <img src="/screenshots/add-device.png" alt="Add device button" width="1170" height="720" />
        </main>
      </body>
    </html>
    """
    images = _extract_image_candidates_from_html("https://docs.example.com/tutorials/pair-device", html)

    assert len(images) == 2
    assert images[0].in_chrome is True
    assert images[0].width == 24
    assert images[0].height == 24
    assert images[1].in_chrome is False
    assert images[1].section_heading == "Pair a new device"
