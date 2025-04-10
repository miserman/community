init_package <- function(name = "package", dir = ".") {
  dir.create(paste0(dir, "/", name, "/R"), FALSE, TRUE)
  dir.create(paste0(dir, "/", name, "/inst/specs"), FALSE, TRUE)
  dir.create(paste0(dir, "/", name, "/tests/testthat"), FALSE, TRUE)
}

parse_rule <- function(condition) {
  comb_type <- grepl("|", condition, fixed = TRUE)
  conds <- strsplit(gsub("\\s*([&|><=]+|!=+)\\s*", " \\1 ", gsub("=+", "=", condition)), " [&|]+ ")[[1]]
  lapply(conds, function(co) {
    co <- strsplit(co, "\\s")[[1]]
    if (length(co) == 1) co <- c(sub("^!+", "", co), if (grepl("^!\\w", co)) "!" else "", "")
    Filter(function(e) {
      length(e) != 1 || if (is.logical(e)) e else TRUE
    }, if (tolower(co[2]) %in% c("true", "false")) {
      list(
        id = co[1],
        type = if (tolower(co[2]) == "true") "" else "!",
        value = ""
      )
    } else {
      list(
        id = co[1],
        type = co[2],
        value = if (grepl("^\\d+$", co[3])) {
          as.numeric(co[3])
        } else {
          gsub("[\"']", "", co[3])
        },
        any = comb_type
      )
    })
  })
}

process_conditions <- function(conditions, ids, caller) {
  for (i in seq_along(conditions)) {
    if (conditions[i] != "") {
      display <- TRUE
      if (grepl("^[dl][^:]*:", conditions[i], TRUE)) {
        if (grepl("^l", conditions[i], TRUE)) display <- FALSE
        conditions[i] <- sub("^[dl][^:]*:\\s*", "", conditions[i], TRUE)
      }
      caller$rules <- c(caller$rules, list(list(
        condition = parse_rule(conditions[i]),
        effects = if (display) list(display = ids[i]) else list(lock = ids[i])
      )))
    }
  }
}

to_input_row <- function(e) {
  c(
    '<div class="col">', e[2], "</div>",
    '<div class="col">', e[-c(1:2, length(e))], "</div>"
  )
}

make_build_environment <- function() {
  e <- new.env()
  attr(e, "name") <- "community_site_parts"
  e$site_build <- function(...) {}
  e$uid <- 0
  e
}

calculate_sha <- function(file, level) {
  if (Sys.which("openssl") != "") {
    tryCatch(
      strsplit(
        system2("openssl", c("dgst", paste0("-sha", level), shQuote(file)), TRUE), " ",
        fixed = TRUE
      )[[1]][2],
      error = function(e) ""
    )
  } else {
    ""
  }
}

head_import <- function(d, dir = ".") {
  if (!is.null(d$src) && (!d$src %in% c("script.js", "style.css") || (file.exists(paste0(dir, "/docs/", d$src)) &&
    file.size(paste0(dir, "/docs/", d$src))))) {
    paste(c(
      "<", if (d$type == "script") 'script type="application/javascript" src="' else 'link href="', d$src, '"',
      if (!is.null(d$hash)) c(' integrity="', d$hash, '"', ' crossorigin="anonymous"'),
      if (d$type == "stylesheet") {
        c(
          ' rel="', if (!is.null(d$loading)) d$loading else "preload", '" as="style" media="all"',
          ' onload="this.onload=null;this.rel=\'stylesheet\'"'
        )
      },
      if (d$type == "script") {
        if (is.null(d$loading)) {
          " async"
        } else {
          if (d$loading == "") "" else c(" ", d$loading)
        }
      }, ">", if (d$type == "script") "</script>"
    ), collapse = "")
  }
}

make_full_name <- function(filename, variable) {
  sub("^:", "", paste0(sub(
    "^.*[\\\\/]", "",
    gsub("^.*\\d{4}(?:q\\d)?_|\\.\\w{3,4}(?:\\.[gbx]z2?)?$|\\..*$", "", basename(filename))
  ), ":", variable))
}

replace_equations <- function(info) {
  lapply(info, function(e) {
    if (!is.list(e)) e <- list(default = e)
    descriptions <- grep("description", names(e), fixed = TRUE)
    if (length(descriptions)) {
      for (d in descriptions) {
        p <- gregexpr(
          "(?:\\$|\\\\\\[|\\\\\\(|\\\\begin\\{math\\})(.+?)(?:\\$|\\\\\\]|\\\\\\)|\\\\end\\{math\\})(?=\\s|$)",
          e[[d]],
          perl = TRUE
        )[[1]]
        if (p[[1]] != -1) {
          re <- paste("", e[[d]], "")
          fm <- regmatches(e[[d]], p)
          for (i in seq_along(p)) {
            mp <- attr(p, "capture.start")[i, ]
            eq <- substring(e[[d]], mp, mp + attr(p, "capture.length")[i, ] - 1)
            parsed <- tryCatch(katex_mathml(eq), error = function(e) NULL)
            if (!is.null(parsed)) {
              re <- paste(
                strsplit(re, fm[[i]], fixed = TRUE)[[1]],
                collapse = sub("^<[^>]*>", "", sub("<[^>]*>$", "", parsed))
              )
            }
          }
          e[[d]] <- gsub("^ | $", "", re)
        }
      }
    }
    if (is.list(e$categories)) e$categories <- replace_equations(e$categories)
    if (is.list(e$variants)) e$variants <- replace_equations(e$variants)
    e
  })
}

preprocess <- function(l) {
  if (!is.list(l)) l <- sapply(l, function(n) list())
  ns <- names(l)
  for (i in seq_along(l)) {
    name <- if (ns[i] == "blank") "" else ns[i]
    l[[i]]$name <- name
    if (is.null(l[[i]]$default)) l[[i]]$default <- name
  }
  l
}

replace_dynamic <- function(e, p, s, v = NULL, default = "default") {
  m <- gregexpr(p, e)
  if (m[[1]][[1]] != -1) {
    t <- regmatches(e, m)[[1]]
    tm <- structure(gsub("\\{[^.]+\\.?|\\}", "", t), names = t)
    tm <- tm[!duplicated(names(tm))]
    tm[tm == ""] <- default
    for (tar in names(tm)) {
      us <- (if (is.null(v) || substring(tar, 2, 2) == "c") s else v)
      entry <- tm[[tar]]
      if (is.null(us[[entry]]) && grepl("description", entry, fixed = TRUE)) {
        entry <- default <- "description"
      }
      if (is.null(us[[entry]]) && entry == default) entry <- "default"
      if (is.null(us[[entry]])) cli_abort("failed to render measure info from {tar}")
      e <- gsub(tar, us[[entry]], e, fixed = TRUE)
    }
  }
  e
}

prepare_source <- function(o, s, p) {
  if (length(o)) {
    lapply(o, function(e) {
      if (is.character(e) && length(e) == 1) replace_dynamic(e, p, s) else e
    })
  } else {
    list(name = "", default = "")
  }
}

render_info_names <- function(infos) {
  r <- lapply(names(infos), function(n) render_info(infos[n], TRUE))
  structure(rep(names(infos), vapply(r, length, 0)), names = unlist(r))
}

render_info <- function(info, names_only = FALSE) {
  base_name <- names(info)
  base <- info[[1]]
  if (is.null(base$categories) && is.null(base$variants)) {
    return(if (names_only) base_name else info)
  }
  categories <- preprocess(base$categories)
  variants <- preprocess(base$variants)
  base$categories <- NULL
  base$variants <- NULL
  expanded <- NULL
  vars <- strsplit(as.character(outer(
    if (is.null(names(categories))) "" else names(categories),
    if (is.null(names(variants))) "" else names(variants),
    paste,
    sep = "|||"
  )), "|||", fixed = TRUE)
  for (var in vars) {
    cs <- if (var[1] == "") list() else categories[[var[1]]]
    vs <- if (length(var) == 1 || var[2] == "") list() else variants[[var[2]]]
    cs <- prepare_source(cs, vs, "\\{variants?(?:\\.[^}]+?)?\\}")
    vs <- prepare_source(vs, cs, "\\{categor(?:y|ies)(?:\\.[^}]+?)?\\}")
    s <- c(cs, vs[!names(vs) %in% names(cs)])
    p <- "\\{(?:categor(?:y|ies)|variants?)(?:\\.[^}]+?)?\\}"
    key <- replace_dynamic(base_name, p, cs, vs)
    if (names_only) {
      expanded <- c(expanded, key)
    } else {
      expanded[[key]] <- c(
        structure(lapply(names(base), function(n) {
          e <- base[[n]]
          if (is.character(e) && length(e) == 1) e <- replace_dynamic(e, p, cs, vs, n)
          e
        }), names = names(base)),
        s[!names(s) %in% c(
          "default",
          "name",
          if (any(base[c("long_description", "short_description")] != "")) "description",
          names(base)
        )]
      )
    }
  }
  expanded
}

get_git_remote <- function(config) {
  if (file.exists(config)) {
    conf <- readLines(config)
    branch <- grep("[branch", conf, fixed = TRUE, value = TRUE)
    url <- grep("url =", conf, fixed = TRUE, value = TRUE)
    if (length(branch) && length(url)) {
      paste0(
        gsub("^.+=\\s|\\.git", "", url[[1]]), "/blob/",
        gsub('^[^"]+"|"\\]', "", branch[[1]])
      )
    }
  }
}

attempt_read <- function(file, id_col) {
  tryCatch(
    {
      sep <- if (grepl(".csv", file, fixed = TRUE)) "," else "\t"
      cols <- scan(file, "", nlines = 1, sep = sep, quiet = TRUE)
      types <- rep("?", length(cols))
      types[cols == id_col] <- "c"
      read_delim_arrow(
        gzfile(file), sep,
        col_names = cols, col_types = paste(types, collapse = ""), skip = 1
      )
    },
    error = function(e) NULL
  )
}
