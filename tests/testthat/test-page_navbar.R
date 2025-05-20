library(xml2)

test_that("structure is intact", {
  raw <- page_navbar(title = "title", logo = "https://example.com")
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(html)
  expect_true(xml_length(children) == 1)
  children <- xml_child(children)
  expect_true(xml_length(children) == 1)
  children <- xml_child(children)
  expect_true(xml_length(children) == 1)
  expect_true(xml_length(xml_child(children)) == 2)
})

test_that("build environment is added to", {
  content <- gsub(
    "submenu1",
    "submenu01",
    page_navbar(
      title = "title",
      logo = "https://example.com",
      list(
        name = "menu",
        title = "Menu",
        items = list(input_select("menu select", c("a", "b")))
      )
    ),
    fixed = TRUE
  )
  parts <- make_build_environment()
  eval(
    expression(
      page_navbar(
        title = "title",
        logo = "https://example.com",
        list(
          name = "menu",
          title = "Menu",
          items = list(input_select("menu select", c("a", "b")))
        )
      )
    ),
    parts
  )
  expect_true(parts$uid == 1)
  expect_identical(parts$header, content)
})
